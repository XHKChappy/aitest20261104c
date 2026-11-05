import type { Env, Agent, ChatRecord } from "./types";
import { json, now, uid } from "./types";
import { askAI, maybeExtractMemory } from "./ai";

const getAgent = async (env: Env, id: number) =>
  env.DB?.prepare("SELECT * FROM agents WHERE id = ?").bind(id).first<Agent>();

// Process any pending delayed messages that are due
export async function deliverDueDelayedMessages(env: Env, agentId?: number): Promise<number> {
  if (!env.DB) return 0;
  const currentTime = now();
  const query = agentId
    ? "SELECT * FROM delayed_messages WHERE agent_id = ? AND status = 'pending' AND trigger_at <= ? ORDER BY trigger_at ASC, sequence_index ASC"
    : "SELECT * FROM delayed_messages WHERE status = 'pending' AND trigger_at <= ? ORDER BY trigger_at ASC, sequence_index ASC";

  const rows = agentId
    ? await env.DB.prepare(query).bind(agentId, currentTime).all<any>()
    : await env.DB.prepare(query).bind(currentTime).all<any>();

  let deliveredCount = 0;
  for (const m of rows.results || []) {
    const msgUid = uid();
    await env.DB.prepare(`
      INSERT INTO chat_records(message_uid, agent_id, role, content, status, is_read_by_host, is_read_by_ai, created_at)
      VALUES (?, ?, 'assistant', ?, 'sent', 0, 1, ?)
    `).bind(msgUid, m.agent_id, m.content, currentTime).run();

    await env.DB.prepare(`
      UPDATE delayed_messages SET status = 'sent', sent_at = ? WHERE id = ?
    `).bind(currentTime, m.id).run();

    deliveredCount++;
  }
  return deliveredCount;
}

export async function sendChat(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const b = await req.json().catch(() => ({})) as any;
  const agentId = Number(b.agentId);
  const content = String(b.content || "").trim();
  const messageUid = String(b.messageUid || uid());

  if (!agentId || !content || content.length > 8000) {
    return json({ error: "参数错误或消息过长（最多8000字符）" }, 400);
  }

  const agent = await getAgent(env, agentId);
  if (!agent) return json({ error: "智能体不存在" }, 404);
  if (!agent.enabled) return json({ error: "该智能体已被停用" }, 403);

  // Check duplicate message
  const existed = await env.DB.prepare(
    "SELECT id, status FROM chat_records WHERE message_uid = ?"
  ).bind(messageUid).first<any>();
  if (existed) {
    return json({ ok: true, duplicate: true, messageId: existed.id });
  }

  // 1. Interruption / Rethink Strategy
  const settings = await env.DB.prepare("SELECT * FROM settings WHERE id = 1").first<any>();
  const policy = settings?.delayed_message_policy || "rethink";

  const pendingTasks = await env.DB.prepare(
    "SELECT id, content, delay_seconds FROM delayed_messages WHERE agent_id = ? AND status = 'pending'"
  ).bind(agentId).all<any>();

  let extraContext = "";
  if (pendingTasks.results && pendingTasks.results.length > 0) {
    if (policy === "cancel") {
      await env.DB.prepare(
        "UPDATE delayed_messages SET status = 'cancelled' WHERE agent_id = ? AND status = 'pending'"
      ).bind(agentId).run();
    } else if (policy === "rethink") {
      const cancelledList = (pendingTasks.results || []).map(p => `"${p.content}"`).join("、");
      extraContext = `【系统提醒: 你此前规划但尚未发出的延迟消息已被中断: ${cancelledList}。请根据宿主最新发送的内容，重新判断并组织整体回复。】`;
      await env.DB.prepare(
        "UPDATE delayed_messages SET status = 'cancelled' WHERE agent_id = ? AND status = 'pending'"
      ).bind(agentId).run();
    }
    // If policy === "continue", leave pending tasks as is
  }

  // 2. Insert host message into chat_records
  const currentTime = now();
  await env.DB.prepare(`
    INSERT INTO chat_records(message_uid, agent_id, role, content, status, is_read_by_host, is_read_by_ai, created_at)
    VALUES (?, ?, 'user', ?, 'sent', 1, 1, ?)
  `).bind(messageUid, agentId, content, currentTime).run();

  // 3. Call AI
  try {
    const result = await askAI(env, agent, "chat", content, extraContext);

    let firstReplyText = result.text;
    const planId = uid();
    let hasDelayed = false;
    let nextDelaySeconds = 0;

    if (result.structuredMessages && result.structuredMessages.length > 1) {
      firstReplyText = result.structuredMessages[0].content;
      hasDelayed = true;
      nextDelaySeconds = result.structuredMessages[1].delay_seconds;

      // Save subsequent messages to delayed_messages queue
      let accumulatedDelay = 0;
      for (let i = 1; i < result.structuredMessages.length; i++) {
        const item = result.structuredMessages[i];
        accumulatedDelay += Math.max(2, Math.min(settings?.max_delay_seconds || 300, item.delay_seconds || 5));
        await env.DB.prepare(`
          INSERT INTO delayed_messages(agent_id, plan_id, sequence_index, delay_seconds, trigger_at, content, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `).bind(agentId, planId, i, accumulatedDelay, currentTime + accumulatedDelay, item.content, currentTime).run();
      }
    }

    // Insert first assistant message into chat_records
    const assistantUid = uid();
    await env.DB.prepare(`
      INSERT INTO chat_records(message_uid, agent_id, role, content, status, is_read_by_host, is_read_by_ai, created_at)
      VALUES (?, ?, 'assistant', ?, 'sent', 1, 1, ?)
    `).bind(assistantUid, agentId, firstReplyText, currentTime).run();

    // Trigger memory extraction in background
    const history = await env.DB.prepare(
      "SELECT role, content FROM chat_records WHERE agent_id = ? ORDER BY id DESC LIMIT 12"
    ).bind(agentId).all<any>();
    const convText = (history.results || []).reverse().map((x: any) => `${x.role}: ${x.content}`).join("\n");
    await maybeExtractMemory(env, agent, convText);

    return json({
      ok: true,
      reply: firstReplyText,
      messageUid: assistantUid,
      has_delayed: hasDelayed,
      next_delay_seconds: nextDelaySeconds
    });
  } catch (err: any) {
    await env.DB.prepare(
      "UPDATE chat_records SET status = 'failed' WHERE message_uid = ?"
    ).bind(messageUid).run();
    return json({ error: String(err.message || err), messageUid, retryable: true }, 502);
  }
}

export async function getConversations(env: Env): Promise<Response> {
  if (!env.DB) return json([]);

  // Check any due delayed messages
  await deliverDueDelayedMessages(env);

  const agents = await env.DB.prepare(`
    SELECT a.id, a.name, a.remark, a.avatar_url, a.is_pinned, a.is_muted, a.group_name, a.enabled,
      (SELECT content FROM chat_records WHERE agent_id = a.id ORDER BY id DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM chat_records WHERE agent_id = a.id ORDER BY id DESC LIMIT 1) AS last_time,
      (SELECT COUNT(*) FROM chat_records WHERE agent_id = a.id AND role = 'assistant' AND is_read_by_host = 0) AS unread_count,
      (SELECT COUNT(*) FROM delayed_messages WHERE agent_id = a.id AND status = 'pending') AS pending_delayed_count
    FROM agents a
    ORDER BY a.is_pinned DESC, COALESCE((SELECT created_at FROM chat_records WHERE agent_id = a.id ORDER BY id DESC LIMIT 1), a.created_at) DESC
  `).all<any>();

  return json(agents.results || []);
}

export async function getChatHistory(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json([]);
  const url = new URL(req.url);
  const agentId = Number(url.searchParams.get("agentId"));
  if (!agentId) return json([]);

  // 1. Deliver any due delayed messages
  await deliverDueDelayedMessages(env, agentId);

  // 2. Mark messages as read by host
  await env.DB.prepare(
    "UPDATE chat_records SET is_read_by_host = 1 WHERE agent_id = ? AND is_read_by_host = 0"
  ).bind(agentId).run();

  // 3. Fetch history
  const records = await env.DB.prepare(
    "SELECT id, message_uid, role, content, status, is_read_by_host, created_at FROM chat_records WHERE agent_id = ? ORDER BY id ASC LIMIT 300"
  ).bind(agentId).all<any>();

  // Check if there are any remaining pending delayed messages
  const pendingDelayed = await env.DB.prepare(
    "SELECT id, trigger_at, delay_seconds, status FROM delayed_messages WHERE agent_id = ? AND status = 'pending' ORDER BY trigger_at ASC LIMIT 1"
  ).bind(agentId).first<any>();

  return json({
    messages: records.results || [],
    has_pending_delayed: !!pendingDelayed,
    next_trigger_in: pendingDelayed ? Math.max(0, pendingDelayed.trigger_at - now()) : 0
  });
}

export async function regenerateChat(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);
  const b = await req.json().catch(() => ({})) as any;
  const agentId = Number(b.agentId);
  if (!agentId) return json({ error: "agentId 必填" }, 400);

  const agent = await getAgent(env, agentId);
  if (!agent) return json({ error: "智能体不存在" }, 404);

  // Find the last assistant message
  const lastAssistant = await env.DB.prepare(
    "SELECT id, message_uid FROM chat_records WHERE agent_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 1"
  ).bind(agentId).first<any>();

  if (lastAssistant) {
    await env.DB.prepare("DELETE FROM chat_records WHERE id = ?").bind(lastAssistant.id).run();
  }

  // Find the last user message
  const lastUser = await env.DB.prepare(
    "SELECT content FROM chat_records WHERE agent_id = ? AND role = 'user' ORDER BY id DESC LIMIT 1"
  ).bind(agentId).first<any>();

  const content = lastUser?.content || "你好";
  const result = await askAI(env, agent, "chat", content);

  const newUid = uid();
  const currentTime = now();
  await env.DB.prepare(`
    INSERT INTO chat_records(message_uid, agent_id, role, content, status, is_read_by_host, is_read_by_ai, created_at)
    VALUES (?, ?, 'assistant', ?, 'sent', 1, 1, ?)
  `).bind(newUid, agentId, result.text, currentTime).run();

  return json({ ok: true, reply: result.text, messageUid: newUid });
}

export async function editMessage(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);
  const b = await req.json().catch(() => ({})) as any;
  const messageId = Number(b.messageId);
  const newContent = String(b.content || "").trim();
  if (!messageId || !newContent) return json({ error: "参数错误" }, 400);

  const targetMsg = await env.DB.prepare(
    "SELECT * FROM chat_records WHERE id = ? AND role = 'user'"
  ).bind(messageId).first<any>();
  if (!targetMsg) return json({ error: "未找到该用户消息" }, 404);

  // Remove all subsequent messages after this message
  await env.DB.prepare(
    "DELETE FROM chat_records WHERE agent_id = ? AND id > ?"
  ).bind(targetMsg.agent_id, messageId).run();

  // Update user message content
  await env.DB.prepare(
    "UPDATE chat_records SET content = ? WHERE id = ?"
  ).bind(newContent, messageId).run();

  // Re-generate response
  const agent = await getAgent(env, targetMsg.agent_id);
  if (!agent) return json({ ok: true });

  const result = await askAI(env, agent, "chat", newContent);
  const newUid = uid();
  await env.DB.prepare(`
    INSERT INTO chat_records(message_uid, agent_id, role, content, status, is_read_by_host, is_read_by_ai, created_at)
    VALUES (?, ?, 'assistant', ?, 'sent', 1, 1, ?)
  `).bind(newUid, targetMsg.agent_id, result.text, now()).run();

  return json({ ok: true, reply: result.text, messageUid: newUid });
}

export async function deleteChatMessage(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);
  const b = await req.json().catch(() => ({})) as any;
  const messageId = Number(b.messageId);
  if (!messageId) return json({ error: "messageId required" }, 400);

  await env.DB.prepare("DELETE FROM chat_records WHERE id = ?").bind(messageId).run();
  return json({ ok: true });
}

export async function clearChatHistory(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);
  const b = await req.json().catch(() => ({})) as any;
  const agentId = Number(b.agentId);
  if (!agentId) return json({ error: "agentId required" }, 400);

  await env.DB.prepare("DELETE FROM chat_records WHERE agent_id = ?").bind(agentId).run();
  await env.DB.prepare("DELETE FROM delayed_messages WHERE agent_id = ?").bind(agentId).run();
  return json({ ok: true });
}

export async function markAsRead(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);
  const b = await req.json().catch(() => ({})) as any;
  const agentId = Number(b.agentId);
  if (!agentId) return json({ error: "agentId required" }, 400);

  await env.DB.prepare(
    "UPDATE chat_records SET is_read_by_host = 1 WHERE agent_id = ?"
  ).bind(agentId).run();

  return json({ ok: true });
}
