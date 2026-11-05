import type { Env, Agent } from "./types";
import { json, now, uid } from "./types";

export async function listAgents(env: Env): Promise<Response> {
  if (!env.DB) return json([]);

  const rows = await env.DB.prepare(`
    SELECT a.*,
      p.host_impression, p.familiarity_level, p.relation_status, p.emotional_progress, p.recent_relation_changes, p.relation_summary,
      prof.personality, prof.emotional_tendency, prof.social_proactivity, prof.language_style, prof.forbidden_items, prof.dedicated_prompt,
      cp.credential_token, cp.perm_time, cp.perm_timezone, cp.perm_device, cp.perm_location, cp.perm_weather,
      cp.perm_host_profile, cp.perm_host_moments, cp.perm_other_agents, cp.perm_other_moments, cp.perm_social_graph,
      (SELECT COUNT(*) FROM chat_records WHERE agent_id = a.id) AS total_messages,
      (SELECT COUNT(*) FROM agent_memories WHERE agent_id = a.id) AS total_memories
    FROM agents a
    LEFT JOIN agent_preferences p ON p.agent_id = a.id
    LEFT JOIN agent_profiles prof ON prof.agent_id = a.id
    LEFT JOIN agent_context_permissions cp ON cp.agent_id = a.id
    ORDER BY a.is_starred DESC, a.id ASC
  `).all<any>();

  return json(rows.results || []);
}

export async function getAgentDetail(env: Env, id: number): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const agent = await env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(id).first<Agent>();
  if (!agent) return json({ error: "智能体不存在" }, 404);

  const [preferences, profile, permissions, modelWhitelist, memoryStats, tokenStats] = await Promise.all([
    env.DB.prepare("SELECT * FROM agent_preferences WHERE agent_id = ?").bind(id).first<any>(),
    env.DB.prepare("SELECT * FROM agent_profiles WHERE agent_id = ?").bind(id).first<any>(),
    env.DB.prepare("SELECT * FROM agent_context_permissions WHERE agent_id = ?").bind(id).first<any>(),
    env.DB.prepare("SELECT * FROM agent_model_permissions WHERE agent_id = ?").bind(id).all<any>(),
    env.DB.prepare(`
      SELECT memory_type, COUNT(*) AS count
      FROM agent_memories
      WHERE agent_id = ?
      GROUP BY memory_type
    `).bind(id).all<any>(),
    env.DB.prepare(`
      SELECT COUNT(*) AS total_calls,
        SUM(prompt_tokens) AS total_prompt_tokens,
        SUM(completion_tokens) AS total_completion_tokens,
        SUM(total_tokens) AS total_tokens,
        SUM(estimated_cost) AS total_cost
      FROM api_usage_logs
      WHERE agent_id = ?
    `).bind(id).first<any>()
  ]);

  return json({
    agent,
    preferences: preferences || {
      host_impression: "初次相识",
      familiarity_level: 10,
      relation_status: "普通朋友",
      emotional_progress: 0.1,
      recent_relation_changes: "",
      relation_summary: ""
    },
    profile: profile || {
      personality: "",
      emotional_tendency: "温和",
      social_proactivity: "适度主动",
      language_style: "自然生活化",
      forbidden_items: "",
      dedicated_prompt: ""
    },
    permissions: permissions || {
      credential_token: `agent_tok_${id}_${uid().slice(0, 8)}`,
      perm_time: 1,
      perm_timezone: 1,
      perm_device: 0,
      perm_location: 0,
      perm_weather: 0,
      perm_host_profile: 1,
      perm_host_moments: 1,
      perm_other_agents: 1,
      perm_other_moments: 1,
      perm_social_graph: 0,
      daily_limit: 100
    },
    model_whitelist: (modelWhitelist.results || []).map((m: any) => m.model_name),
    memory_stats: memoryStats.results || [],
    token_stats: tokenStats || {}
  });
}

export async function saveAgent(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const b = await req.json().catch(() => ({})) as any;
  const id = Number(b.id) || 0;
  const name = String(b.name || "").trim();
  if (!name) return json({ error: "智能体名称不能为空" }, 400);

  const currentTime = now();
  const fields = [
    name,
    String(b.wechat_id || "").trim() || `agent_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${id || uid().slice(0, 4)}`,
    String(b.avatar_url || ""),
    String(b.persona || ""),
    String(b.force_prompt || ""),
    String(b.habits || ""),
    String(b.interests || ""),
    String(b.values_text || ""),
    String(b.remark || ""),
    String(b.group_name || "我的AI好友"),
    Number(b.is_starred ?? 0),
    Number(b.is_pinned ?? 0),
    Number(b.is_muted ?? 0),
    Number(b.enabled ?? 1),
    Number(b.auto_post_enabled ?? 1),
    Number(b.auto_interact_enabled ?? 1),
    Number(b.respond_to_user_like ?? 1),
    Number(b.allow_agent_interactions ?? 1),
    String(b.activity_level || "medium"),
    Math.max(0, Math.min(1, Number(b.interaction_probability ?? 0.4))),
    Math.max(5, Number(b.min_action_interval_minutes) || 30),
    Math.max(0, Number(b.daily_api_limit ?? 50)),
    Math.max(0, Number(b.daily_post_limit ?? 3)),
    currentTime
  ];

  let agentId = id;
  if (id) {
    await env.DB.prepare(`
      UPDATE agents SET
        name = ?, wechat_id = ?, avatar_url = ?, persona = ?, force_prompt = ?,
        habits = ?, interests = ?, values_text = ?, remark = ?, group_name = ?,
        is_starred = ?, is_pinned = ?, is_muted = ?, enabled = ?,
        auto_post_enabled = ?, auto_interact_enabled = ?, respond_to_user_like = ?, allow_agent_interactions = ?,
        activity_level = ?, interaction_probability = ?, min_action_interval_minutes = ?,
        daily_api_limit = ?, daily_post_limit = ?, updated_at = ?
      WHERE id = ?
    `).bind(...fields, id).run();
  } else {
    const res = await env.DB.prepare(`
      INSERT INTO agents(
        name, wechat_id, avatar_url, persona, force_prompt,
        habits, interests, values_text, remark, group_name,
        is_starred, is_pinned, is_muted, enabled,
        auto_post_enabled, auto_interact_enabled, respond_to_user_like, allow_agent_interactions,
        activity_level, interaction_probability, min_action_interval_minutes,
        daily_api_limit, daily_post_limit, updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(...fields, currentTime).run();
    agentId = Number(res.meta.last_row_id);
  }

  // Save / Update preferences
  if (b.preferences || !id) {
    const p = b.preferences || {};
    await env.DB.prepare(`
      INSERT INTO agent_preferences(agent_id, host_impression, familiarity_level, relation_status, emotional_progress, recent_relation_changes, relation_summary, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        host_impression = excluded.host_impression,
        familiarity_level = excluded.familiarity_level,
        relation_status = excluded.relation_status,
        emotional_progress = excluded.emotional_progress,
        recent_relation_changes = excluded.recent_relation_changes,
        relation_summary = excluded.relation_summary,
        updated_at = excluded.updated_at
    `).bind(
      agentId,
      String(p.host_impression || "初次相识，尚在熟悉中"),
      Number(p.familiarity_level ?? 10),
      String(p.relation_status || "普通朋友"),
      Number(p.emotional_progress ?? 0.1),
      String(p.recent_relation_changes || "初建好友"),
      String(p.relation_summary || ""),
      currentTime
    ).run();
  }

  // Save / Update profile
  if (b.profile || !id) {
    const prof = b.profile || {};
    await env.DB.prepare(`
      INSERT INTO agent_profiles(agent_id, personality, emotional_tendency, social_proactivity, language_style, forbidden_items, dedicated_prompt, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        personality = excluded.personality,
        emotional_tendency = excluded.emotional_tendency,
        social_proactivity = excluded.social_proactivity,
        language_style = excluded.language_style,
        forbidden_items = excluded.forbidden_items,
        dedicated_prompt = excluded.dedicated_prompt,
        updated_at = excluded.updated_at
    `).bind(
      agentId,
      String(prof.personality || ""),
      String(prof.emotional_tendency || "温和稳重"),
      String(prof.social_proactivity || "适度主动"),
      String(prof.language_style || "自然生活化"),
      String(prof.forbidden_items || ""),
      String(prof.dedicated_prompt || ""),
      currentTime
    ).run();
  }

  // Save / Update permissions
  if (b.permissions || !id) {
    const perm = b.permissions || {};
    const defaultToken = `agent_tok_${agentId}_${uid().slice(0, 8)}`;
    await env.DB.prepare(`
      INSERT INTO agent_context_permissions(
        agent_id, credential_token, perm_time, perm_timezone, perm_device, perm_location, perm_weather,
        perm_host_profile, perm_host_moments, perm_other_agents, perm_other_moments, perm_social_graph, daily_limit, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        perm_time = excluded.perm_time,
        perm_timezone = excluded.perm_timezone,
        perm_device = excluded.perm_device,
        perm_location = excluded.perm_location,
        perm_weather = excluded.perm_weather,
        perm_host_profile = excluded.perm_host_profile,
        perm_host_moments = excluded.perm_host_moments,
        perm_other_agents = excluded.perm_other_agents,
        perm_other_moments = excluded.perm_other_moments,
        perm_social_graph = excluded.perm_social_graph,
        daily_limit = excluded.daily_limit,
        updated_at = excluded.updated_at
    `).bind(
      agentId,
      perm.credential_token || defaultToken,
      Number(perm.perm_time ?? 1),
      Number(perm.perm_timezone ?? 1),
      Number(perm.perm_device ?? 0),
      Number(perm.perm_location ?? 0),
      Number(perm.perm_weather ?? 0),
      Number(perm.perm_host_profile ?? 1),
      Number(perm.perm_host_moments ?? 1),
      Number(perm.perm_other_agents ?? 1),
      Number(perm.perm_other_moments ?? 1),
      Number(perm.perm_social_graph ?? 0),
      Number(perm.daily_limit ?? 100),
      currentTime
    ).run();
  }

  return json({ ok: true, id: agentId });
}

export async function deleteAgent(req: Request, env: Env, id: number): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const url = new URL(req.url);
  const deleteData = url.searchParams.get("delete_data") === "true";

  if (deleteData) {
    await env.DB.prepare("DELETE FROM chat_records WHERE agent_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM agent_memories WHERE agent_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM delayed_messages WHERE agent_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM moments WHERE author_type = 'agent' AND author_id = ?").bind(id).run();
  }

  await env.DB.prepare("DELETE FROM agents WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

export async function handleAgentMemories(req: Request, env: Env, agentId: number): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const method = req.method;

  if (method === "GET") {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    let query = "SELECT * FROM agent_memories WHERE agent_id = ?";
    const params: any[] = [agentId];
    if (type) {
      query += " AND memory_type = ?";
      params.push(type);
    }
    query += " ORDER BY importance DESC, updated_at DESC LIMIT 100";
    const res = await env.DB.prepare(query).bind(...params).all<any>();
    return json(res.results || []);
  }

  const b = await req.json().catch(() => ({})) as any;

  if (method === "POST") {
    const content = String(b.content || "").trim();
    if (!content) return json({ error: "记忆内容不能为空" }, 400);
    const memId = Number(b.id) || 0;
    const mType = ["long_term", "fact", "relation", "event", "moment", "emotion", "preference", "system"].includes(b.memory_type)
      ? b.memory_type
      : "fact";
    const importance = Math.max(1, Math.min(5, Number(b.importance) || 3));
    const source = String(b.source || "manual");
    const currentTime = now();

    if (memId) {
      await env.DB.prepare(`
        UPDATE agent_memories SET memory_type = ?, content = ?, importance = ?, updated_at = ?
        WHERE id = ? AND agent_id = ?
      `).bind(mType, content, importance, currentTime, memId, agentId).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO agent_memories(agent_id, memory_type, content, importance, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(agentId, mType, content, importance, source, currentTime, currentTime).run();
    }
    return json({ ok: true });
  }

  if (method === "DELETE") {
    const memoryId = Number(b.memoryId);
    if (!memoryId) return json({ error: "memoryId required" }, 400);
    await env.DB.prepare("DELETE FROM agent_memories WHERE id = ? AND agent_id = ?").bind(memoryId, agentId).run();
    return json({ ok: true });
  }

  return json({ error: "不支持的方法" }, 405);
}

export async function mergeAgentMemories(req: Request, env: Env, agentId: number): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  // Group by content or find near duplicates
  const allMems = await env.DB.prepare(
    "SELECT id, content, importance, memory_type FROM agent_memories WHERE agent_id = ? ORDER BY id ASC"
  ).bind(agentId).all<any>();

  const seen = new Map<string, number>();
  const toDelete: number[] = [];

  for (const m of allMems.results || []) {
    const norm = m.content.trim().toLowerCase();
    if (seen.has(norm)) {
      toDelete.push(m.id);
    } else {
      seen.set(norm, m.id);
    }
  }

  for (const id of toDelete) {
    await env.DB.prepare("DELETE FROM agent_memories WHERE id = ?").bind(id).run();
  }

  return json({ ok: true, merged_count: toDelete.length });
}
