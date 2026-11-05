import type { Env } from "./types";
import { json, now } from "./types";

export async function handleAgentContextApi(req: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求格式必须为有效 JSON" }, 400);
  }

  const agentId = Number(body.agent_id);
  const token = String(body.token || "").trim();
  const categories: string[] = Array.isArray(body.categories) ? body.categories.map(String) : [];

  if (!agentId || !token) {
    return json({ error: "agent_id 与专属 token 凭证不能为空" }, 401);
  }

  // 1. Verify agent exists & enabled
  const agent = await env.DB.prepare(
    "SELECT id, name, enabled FROM agents WHERE id = ?"
  ).bind(agentId).first<any>();

  if (!agent || !agent.enabled) {
    await logContextAccess(env, agentId, categories, [], req, Date.now() - startTime, false, "智能体不存在或已被禁用");
    return json({ error: "智能体未启用或不存在" }, 403);
  }

  // 2. Verify token & permissions
  const perm = await env.DB.prepare(
    "SELECT * FROM agent_context_permissions WHERE agent_id = ?"
  ).bind(agentId).first<any>();

  if (!perm || perm.credential_token !== token) {
    await logContextAccess(env, agentId, categories, [], req, Date.now() - startTime, false, "Token 凭证校验失败");
    return json({ error: "凭证无效或未配置访问权限" }, 401);
  }

  // 3. Rate limit check (daily calls)
  const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const callCount = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM context_access_logs WHERE agent_id = ? AND created_at >= ?"
  ).bind(agentId, todayStart).first<{ c: number }>();

  if ((callCount?.c || 0) >= (perm.daily_limit || 100)) {
    await logContextAccess(env, agentId, categories, [], req, Date.now() - startTime, false, "已超出该智能体每日信息接口调用配额");
    return json({ error: "已超出每日调用额度限制" }, 429);
  }

  // 4. Resolve granted categories
  const grantedCategories: string[] = [];
  const responseData: Record<string, any> = {};

  const reqHas = (cat: string) => categories.length === 0 || categories.includes(cat);

  // Time & Timezone
  if (reqHas("time") && perm.perm_time) {
    grantedCategories.push("time");
    responseData.time = {
      timestamp: now(),
      iso: new Date().toISOString(),
      formatted: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    };
  }

  if (reqHas("timezone") && perm.perm_timezone) {
    grantedCategories.push("timezone");
    responseData.timezone = {
      name: "Asia/Shanghai",
      offset: "+08:00"
    };
  }

  // Device
  if (reqHas("device") && perm.perm_device) {
    grantedCategories.push("device");
    responseData.device = {
      platform: "iOS / WeChat Client",
      client_version: "8.0.50",
      network_type: "Wi-Fi"
    };
  }

  // Location & Weather (Requires explicit permission)
  if (reqHas("location") && perm.perm_location) {
    grantedCategories.push("location");
    responseData.location = {
      city: "上海市",
      district: "浦东新区",
      note: "基于宿主授权的常用社交区域"
    };
  }

  if (reqHas("weather") && perm.perm_weather) {
    grantedCategories.push("weather");
    responseData.weather = {
      condition: "晴间多云",
      temperature: "22°C",
      air_quality: "良 (AQI 45)",
      comfort: "舒适"
    };
  }

  // Host Profile
  if (reqHas("host_profile") && perm.perm_host_profile) {
    grantedCategories.push("host_profile");
    const host = await env.DB.prepare(
      "SELECT id, nickname, signature, avatar_url FROM users WHERE id = 1"
    ).first<any>();
    responseData.host_profile = host;
  }

  // Host Moments
  if (reqHas("host_moments") && perm.perm_host_moments) {
    grantedCategories.push("host_moments");
    const hostMoments = await env.DB.prepare(
      "SELECT id, content, created_at FROM moments WHERE author_type = 'user' ORDER BY id DESC LIMIT 5"
    ).all<any>();
    responseData.host_moments = hostMoments.results || [];
  }

  // Other Agents (Public profile)
  if (reqHas("other_agents") && perm.perm_other_agents) {
    grantedCategories.push("other_agents");
    const otherAgents = await env.DB.prepare(
      "SELECT id, name, wechat_id, avatar_url, persona, habits, interests FROM agents WHERE id != ? AND enabled = 1"
    ).bind(agentId).all<any>();
    responseData.other_agents = otherAgents.results || [];
  }

  // Other Moments (Public only)
  if (reqHas("other_moments") && perm.perm_other_moments) {
    grantedCategories.push("other_moments");
    const otherMoments = await env.DB.prepare(`
      SELECT m.id, m.author_id, a.name AS author_name, m.content, m.created_at
      FROM moments m
      JOIN agents a ON a.id = m.author_id
      WHERE m.author_type = 'agent' AND m.author_id != ? AND m.visibility = 'public'
      ORDER BY m.id DESC LIMIT 8
    `).bind(agentId).all<any>();
    responseData.other_moments = otherMoments.results || [];
  }

  // Social Graph
  if (reqHas("social_graph") && perm.perm_social_graph) {
    grantedCategories.push("social_graph");
    const rules = await env.DB.prepare(
      "SELECT target_agent_id, allow_interact, allow_view_moments FROM agent_interaction_rules WHERE agent_id = ?"
    ).bind(agentId).all<any>();
    responseData.social_graph = rules.results || [];
  }

  const durationMs = Date.now() - startTime;
  await logContextAccess(env, agentId, categories, grantedCategories, req, durationMs, true, "");

  return json({
    ok: true,
    agent_id: agentId,
    granted_categories: grantedCategories,
    data: responseData
  });
}

async function logContextAccess(
  env: Env,
  agentId: number,
  requested: string[],
  granted: string[],
  req: Request,
  durationMs: number,
  success: boolean,
  errorMsg: string
) {
  if (!env.DB) return;
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
  try {
    await env.DB.prepare(`
      INSERT INTO context_access_logs(agent_id, categories_requested, categories_granted, ip, duration_ms, success, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      agentId,
      requested.join(",") || "all",
      granted.join(","),
      ip.slice(0, 50),
      durationMs,
      success ? 1 : 0,
      errorMsg.slice(0, 300),
      now()
    ).run();
  } catch {
    // Ignore logging errors
  }
}
