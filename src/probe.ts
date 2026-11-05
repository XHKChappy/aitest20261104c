import type { Env, Agent } from "./types";
import { json, now } from "./types";
import { askAI } from "./ai";
import { deliverDueDelayedMessages } from "./chatModules";

const rand = () => Math.random();

async function dailyCallCount(env: Env, agentId: number): Promise<number> {
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const r = await env.DB?.prepare(
    "SELECT COUNT(*) AS n FROM api_usage_logs WHERE agent_id = ? AND created_at >= ?"
  ).bind(agentId, startOfDay).first<any>();
  return Number(r?.n) || 0;
}

export async function processMomentEvent(env: Env, agent: Agent, event: string, payload: any) {
  if (!agent.enabled || !env.DB) return;

  const isImmediateUserPost = event === "user_moment";

  // Check cooldown & probability unless immediate user post
  if (!isImmediateUserPost) {
    if (now() - agent.last_action_at < agent.min_action_interval_minutes * 60) return;
    if (rand() > Math.max(0.1, Math.min(1, agent.interaction_probability))) return;
  }

  const moment = await env.DB.prepare("SELECT * FROM moments WHERE id = ?").bind(payload.momentId).first<any>();
  if (!moment) return;

  // Visibility check: Can this agent see this moment?
  if (moment.visibility === "private" && (moment.author_type !== "agent" || moment.author_id !== agent.id)) return;
  if (moment.visibility === "host_only" && agent.id !== 0) return;
  if (moment.visibility === "blacklist") {
    try {
      const bl = JSON.parse(moment.visibility_agents_json || "[]");
      if (Array.isArray(bl) && bl.includes(agent.id)) return;
    } catch {}
  }
  if (moment.visibility === "whitelist") {
    try {
      const wl = JSON.parse(moment.visibility_agents_json || "[]");
      if (Array.isArray(wl) && !wl.includes(agent.id)) return;
    } catch {}
  }

  // Idempotency: Has this agent already responded to this moment?
  const marker = await env.DB.prepare(
    "SELECT id FROM agent_memories WHERE agent_id = ? AND source = ? LIMIT 1"
  ).bind(agent.id, `moment-response:${moment.id}`).first<any>();
  if (marker) return;

  // Save event to agent's private memory
  const authorDesc = moment.author_type === "user" ? "宿主" : `智能体#${moment.author_id}`;
  const momentMemory = `朋友圈动态#${moment.id} [${authorDesc}]: ${String(moment.content).slice(0, 200)}`;
  await env.DB.prepare(`
    INSERT INTO agent_memories(agent_id, memory_type, content, importance, source, created_at, updated_at)
    VALUES (?, 'moment', ?, 2, ?, ?, ?)
  `).bind(agent.id, momentMemory, `moment:${moment.id}`, now(), now()).run();

  // If auto interact is disabled, or like triggers disabled
  if (!agent.auto_interact_enabled || (event === "user_like" && !agent.respond_to_user_like)) return;
  if (await dailyCallCount(env, agent.id) >= agent.daily_api_limit) return;

  // Fetch recent comments on this moment
  const comments = await env.DB.prepare(`
    SELECT c.actor_type, c.actor_id, c.content,
      CASE WHEN c.actor_type = 'user' THEN '宿主' ELSE COALESCE(a.name, '智能体') END AS actor_name
    FROM comments c
    LEFT JOIN agents a ON a.id = c.actor_id
    WHERE c.moment_id = ?
    ORDER BY c.id DESC LIMIT 8
  `).bind(payload.momentId).all<any>();

  const commentsText = (comments.results || []).map((x: any) => `${x.actor_name}: ${x.content}`).join("; ");

  const promptTask = `你正在浏览微信朋友圈。请根据你的人设、说话风格、对宿主的印象以及过往记忆，决定是否对这条朋友圈互动。
必须且只返回 JSON 格式：
{
  "like": true 或 false,
  "comment": "如果评论请写下自然口语评论，若不评论则为空字符串"
}
说明：
- 可以只点赞、只评论、点赞加评论，或者完全不互动（like: false, comment: ""）。
- 评论要像真实朋友在微信朋友圈留言一样真实简短、口语化，不要使用机械排比或AI客服套话。`;

  const extraContext = `【朋友圈内容】: "${moment.content}"
【发布者】: ${authorDesc}
【当前已有评论】: ${commentsText || "暂无评论"}`;

  try {
    const result = await askAI(env, agent, "moment_interaction", promptTask, extraContext);
    let parsed: any = {};
    try {
      const cleanJson = result.text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      // If parsing fails, skip action
      return;
    }

    const currentTime = now();
    if (parsed.like) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO likes(moment_id, actor_type, actor_id, created_at)
        VALUES (?, 'agent', ?, ?)
      `).bind(payload.momentId, agent.id, currentTime).run();
    }

    if (typeof parsed.comment === "string" && parsed.comment.trim()) {
      await env.DB.prepare(`
        INSERT INTO comments(moment_id, actor_type, actor_id, content, created_at)
        VALUES (?, 'agent', ?, ?, ?)
      `).bind(payload.momentId, agent.id, parsed.comment.trim().slice(0, 500), currentTime).run();
    }

    // Mark as processed
    await env.DB.prepare(`
      INSERT INTO agent_memories(agent_id, memory_type, content, importance, source, created_at, updated_at)
      VALUES (?, 'system', ?, 1, ?, ?, ?)
    `).bind(agent.id, `已完成对朋友圈#${moment.id}的自主互动`, `moment-response:${moment.id}`, currentTime, currentTime).run();

    await env.DB.prepare("UPDATE agents SET last_action_at = ? WHERE id = ?").bind(currentTime, agent.id).run();
  } catch (err: any) {
    await env.DB.prepare("INSERT INTO system_logs(level, message, details) VALUES('error', ?, ?)")
      .bind(`智能体 #${agent.id} 朋友圈自主互动异常`, String(err.message || err).slice(0, 500)).run();
  }
}

async function maybePostAutonomousMoment(env: Env, agent: Agent) {
  if (!agent.enabled || !agent.auto_post_enabled || !env.DB) return;
  const currentTime = now();

  // Cooldown between posts: at least 4 hours
  if (currentTime - agent.last_post_time < 4 * 3600) return;

  // Check daily limit
  const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM moments WHERE author_type = 'agent' AND author_id = ? AND created_at >= ?"
  ).bind(agent.id, todayStart).first<any>();

  if ((Number(count?.n) || 0) >= agent.daily_post_limit) return;
  if ((await dailyCallCount(env, agent.id)) >= agent.daily_api_limit) return;

  // Activity probability check
  const prob = agent.activity_level === "low" ? 0.05 : agent.activity_level === "high" ? 0.25 : 0.12;
  if (rand() > prob) return;

  const memories = await env.DB.prepare(
    "SELECT content FROM agent_memories WHERE agent_id = ? ORDER BY importance DESC, updated_at DESC LIMIT 6"
  ).bind(agent.id).all<any>();

  const memContext = (memories.results || []).map((x: any) => x.content).join("\n");

  const prompt = `请根据你的人设、性格特质、兴趣爱好和最近记忆，判断此时此刻是否有生活琐碎、工作灵感或感悟想发一条朋友圈动态。
规则：
- 如果没有合适的想法，请只输出: NONE
- 如果有想法，请直接输出这条朋友圈文案（不要带引号、不要带前缀）。文案风格必须贴近微信朋友圈真实好友（短小、生活化、真实有感染力，100字以内）。`;

  try {
    const res = await askAI(env, agent, "scheduled_moment", prompt, memContext);
    const text = res.text.trim();
    if (text.toUpperCase() !== "NONE" && text.length > 2 && text.length < 500) {
      await env.DB.prepare(`
        INSERT INTO moments(author_type, author_id, content, visibility, created_at)
        VALUES ('agent', ?, ?, 'public', ?)
      `).bind(agent.id, text, currentTime).run();

      await env.DB.prepare(
        "UPDATE agents SET last_post_time = ?, last_action_at = ? WHERE id = ?"
      ).bind(currentTime, currentTime, agent.id).run();
    }
  } catch (err: any) {
    await env.DB.prepare("INSERT INTO system_logs(level, message, details) VALUES('error', ?, ?)")
      .bind(`智能体 #${agent.id} 自动朋友圈生成异常`, String(err.message || err).slice(0, 500)).run();
  }
}

export async function processUserMomentImmediately(env: Env, momentId: number): Promise<{ agents: number; failed: number }> {
  if (!env.DB) return { agents: 0, failed: 0 };
  const agents = (await env.DB.prepare("SELECT * FROM agents WHERE enabled = 1 ORDER BY id").all<Agent>()).results || [];
  const results = await Promise.allSettled(
    agents.map(agent => processMomentEvent(env, agent, "user_moment", { momentId }))
  );
  const failed = results.filter(r => r.status === "rejected").length;
  return { agents: agents.length, failed };
}

export async function runProbe(env: Env): Promise<{ ok: boolean; [key: string]: any }> {
  if (!env.DB) return { ok: true, skipped: "D1 数据库未配置" };

  const settings = await env.DB.prepare("SELECT * FROM settings WHERE id = 1").first<any>();
  if (!settings || !settings.probe_enabled) return { ok: true, skipped: "探针功能已关闭" };

  // 1. Deliver any pending delayed messages that have matured
  const deliveredCount = await deliverDueDelayedMessages(env);

  // 2. Process pending probe tasks
  const tasks = await env.DB.prepare(
    "SELECT * FROM probe_tasks WHERE status = 'pending' ORDER BY id ASC LIMIT 20"
  ).all<any>();

  const agents = (await env.DB.prepare("SELECT * FROM agents WHERE enabled = 1 ORDER BY id").all<Agent>()).results || [];

  for (const task of tasks.results || []) {
    await env.DB.prepare(
      "UPDATE probe_tasks SET status = 'processing', attempts = attempts + 1 WHERE id = ? AND status = 'pending'"
    ).bind(task.id).run();

    try {
      const payload = JSON.parse(task.payload_json || "{}");
      for (const agent of agents) {
        await processMomentEvent(env, agent, task.event_type, payload);
      }
      await env.DB.prepare(
        "UPDATE probe_tasks SET status = 'done', processed_at = ? WHERE id = ?"
      ).bind(now(), task.id).run();
    } catch (e: any) {
      await env.DB.prepare(
        "UPDATE probe_tasks SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END WHERE id = ?"
      ).bind(task.id).run();
      await env.DB.prepare("INSERT INTO system_logs(level, message, details) VALUES('error', ?, ?)")
        .bind("探针任务处理异常", String(e.message || e).slice(0, 500)).run();
    }
  }

  // 3. Autonomous moment posting
  for (const agent of agents) {
    try {
      await maybePostAutonomousMoment(env, agent);
    } catch (e: any) {
      await env.DB.prepare("INSERT INTO system_logs(level, message, details) VALUES('error', ?, ?)")
        .bind(`智能体 #${agent.id} 探针自发朋友圈异常`, String(e.message || e).slice(0, 500)).run();
    }
  }

  return { ok: true, tasks_processed: (tasks.results || []).length, delivered_messages: deliveredCount };
}

export async function probeHttp(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "D1 数据库未配置" }, 503);
  const supplied = new URL(req.url).searchParams.get("secret") || req.headers.get("x-probe-secret") || "";
  if (!env.PROBE_SECRET || supplied !== env.PROBE_SECRET) {
    return json({ error: "未授权的探针调用" }, 401);
  }
  return json(await runProbe(env));
}
