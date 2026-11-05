import type { Env, Backend, AIModel } from "./types";
import { json, now } from "./types";

export async function listBackends(env: Env): Promise<Response> {
  if (!env.DB) return json([]);

  const backends = await env.DB.prepare(`
    SELECT b.id, b.name, b.base_url, b.default_model, b.enabled, b.priority, b.timeout_ms,
      b.retry_count, b.failure_count, b.cooldown_until, b.last_error, b.last_success_at, b.created_at,
      (SELECT COUNT(*) FROM api_usage_logs WHERE backend_id = b.id) AS call_count,
      (SELECT COUNT(*) FROM api_usage_logs WHERE backend_id = b.id AND success = 1) AS success_count,
      (SELECT SUM(total_tokens) FROM api_usage_logs WHERE backend_id = b.id) AS total_tokens
    FROM ai_backends b
    ORDER BY b.priority ASC, b.id ASC
  `).all<any>();

  // Never return raw API keys
  const sanitized = (backends.results || []).map(b => ({
    ...b,
    api_key_configured: true,
    api_key_masked: "••••••••"
  }));

  return json(sanitized);
}

export async function saveBackend(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const b = await req.json().catch(() => ({})) as any;
  const id = Number(b.id) || 0;
  const name = String(b.name || "").trim().slice(0, 80);
  const baseUrl = String(b.base_url || "").trim().replace(/\/+$/, "");
  const apiKey = String(b.api_key || "").trim();
  const defaultModel = String(b.default_model || b.model || "").trim();
  const enabled = Number(b.enabled ?? 1);
  const priority = Number(b.priority) || 100;
  const timeoutMs = Math.max(3000, Math.min(90000, Number(b.timeout_ms) || 30000));
  const retryCount = Math.max(0, Math.min(5, Number(b.retry_count) || 2));

  if (!name || !baseUrl || !defaultModel) {
    return json({ error: "接口名称、Base URL、默认模型名称必填" }, 400);
  }

  const currentTime = now();

  if (id) {
    if (apiKey) {
      await env.DB.prepare(`
        UPDATE ai_backends SET
          name = ?, base_url = ?, api_key = ?, default_model = ?, enabled = ?, priority = ?,
          timeout_ms = ?, retry_count = ?, failure_count = 0, cooldown_until = 0
        WHERE id = ?
      `).bind(name, baseUrl, apiKey, defaultModel, enabled, priority, timeoutMs, retryCount, id).run();
    } else {
      await env.DB.prepare(`
        UPDATE ai_backends SET
          name = ?, base_url = ?, default_model = ?, enabled = ?, priority = ?,
          timeout_ms = ?, retry_count = ?, failure_count = 0, cooldown_until = 0
        WHERE id = ?
      `).bind(name, baseUrl, defaultModel, enabled, priority, timeoutMs, retryCount, id).run();
    }
  } else {
    if (!apiKey) return json({ error: "新增后端必须输入 API Key" }, 400);
    await env.DB.prepare(`
      INSERT INTO ai_backends(name, base_url, api_key, default_model, enabled, priority, timeout_ms, retry_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(name, baseUrl, apiKey, defaultModel, enabled, priority, timeoutMs, retryCount, currentTime).run();
  }

  return json({ ok: true });
}

export async function deleteBackend(req: Request, env: Env, id: number): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  await env.DB.prepare("DELETE FROM ai_backends WHERE id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM api_backend_call_details WHERE backend_id = ?").bind(id).run();
  return json({ ok: true });
}

export async function testBackend(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const b = await req.json().catch(() => ({})) as any;
  const id = Number(b.id);
  let baseUrl = String(b.base_url || "").trim().replace(/\/+$/, "");
  let apiKey = String(b.api_key || "").trim();
  let model = String(b.default_model || b.model || "").trim();

  if (id) {
    const existing = await env.DB.prepare("SELECT * FROM ai_backends WHERE id = ?").bind(id).first<Backend>();
    if (existing) {
      if (!baseUrl) baseUrl = existing.base_url;
      if (!apiKey) apiKey = existing.api_key;
      if (!model) model = existing.default_model;
    }
  }

  if (!baseUrl || !apiKey || !model) {
    return json({ error: "缺少 Base URL、API Key 或模型名称" }, 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const startTime = Date.now();

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "请输出 'PONG' 并回复确认测试成功" }],
        max_tokens: 30
      })
    });

    const durationMs = Date.now() - startTime;
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return json({
        ok: false,
        durationMs,
        status: resp.status,
        error: `HTTP ${resp.status}: ${errText.slice(0, 300)}`
      });
    }

    const data: any = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "";
    return json({
      ok: true,
      durationMs,
      status: resp.status,
      reply: content.slice(0, 100),
      model_returned: data?.model || model
    });
  } catch (err: any) {
    return json({
      ok: false,
      durationMs: Date.now() - startTime,
      error: err?.message || String(err)
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function getBackendCallDetails(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json([]);

  const url = new URL(req.url);
  const backendId = url.searchParams.get("backend_id");

  let query = `
    SELECT d.*, b.name AS backend_name, COALESCE(a.name, '系统任务') AS agent_name
    FROM api_backend_call_details d
    LEFT JOIN ai_backends b ON b.id = d.backend_id
    LEFT JOIN agents a ON a.id = d.agent_id
  `;
  const params: any[] = [];
  if (backendId) {
    query += " WHERE d.backend_id = ?";
    params.push(Number(backendId));
  }
  query += " ORDER BY d.id DESC LIMIT 40";

  const rows = await env.DB.prepare(query).bind(...params).all<any>();
  return json(rows.results || []);
}

export async function clearBackendCallDetails(env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  // Clear all detailed logs without wiping aggregated stats
  await env.DB.prepare("DELETE FROM api_backend_call_details").run();
  return json({ ok: true, message: "详细调用日志已清空，历史统计数据完整保留" });
}

export async function getTokenStats(env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  // Overall sums
  const overall = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total_calls,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success_calls,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS fail_calls,
      SUM(prompt_tokens) AS total_prompt_tokens,
      SUM(completion_tokens) AS total_completion_tokens,
      SUM(total_tokens) AS total_tokens,
      SUM(estimated_cost) AS total_estimated_cost,
      AVG(duration_ms) AS avg_duration_ms
    FROM api_usage_logs
  `).first<any>();

  // Daily trend
  const dailyRows = await env.DB.prepare(`
    SELECT * FROM token_daily_stats ORDER BY date DESC LIMIT 14
  `).all<any>();

  // Model distribution
  const modelDist = await env.DB.prepare(`
    SELECT model, COUNT(*) AS count, SUM(total_tokens) AS tokens, SUM(estimated_cost) AS cost
    FROM api_usage_logs
    GROUP BY model
    ORDER BY tokens DESC LIMIT 10
  `).all<any>();

  // Backend distribution
  const backendDist = await env.DB.prepare(`
    SELECT b.name, COUNT(l.id) AS count, SUM(l.total_tokens) AS tokens, SUM(l.estimated_cost) AS cost
    FROM api_usage_logs l
    LEFT JOIN ai_backends b ON b.id = l.backend_id
    GROUP BY l.backend_id
    ORDER BY tokens DESC LIMIT 10
  `).all<any>();

  // Agent distribution
  const agentDist = await env.DB.prepare(`
    SELECT COALESCE(a.name, '系统/探针') AS agent_name, COUNT(l.id) AS count, SUM(l.total_tokens) AS tokens, SUM(l.estimated_cost) AS cost
    FROM api_usage_logs l
    LEFT JOIN agents a ON a.id = l.agent_id
    GROUP BY l.agent_id
    ORDER BY tokens DESC LIMIT 10
  `).all<any>();

  return json({
    overall: {
      total_calls: Number(overall?.total_calls) || 0,
      success_calls: Number(overall?.success_calls) || 0,
      fail_calls: Number(overall?.fail_calls) || 0,
      prompt_tokens: Number(overall?.total_prompt_tokens) || 0,
      completion_tokens: Number(overall?.total_completion_tokens) || 0,
      total_tokens: Number(overall?.total_tokens) || 0,
      estimated_cost: Number((Number(overall?.total_estimated_cost) || 0).toFixed(4)),
      avg_duration_ms: Math.round(Number(overall?.avg_duration_ms) || 0),
      note: "费用为基于官方标准费率计算的估算值"
    },
    daily: (dailyRows.results || []).reverse(),
    model_distribution: modelDist.results || [],
    backend_distribution: backendDist.results || [],
    agent_distribution: agentDist.results || []
  });
}
