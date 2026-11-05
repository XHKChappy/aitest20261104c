import type { Env } from "./types";
import { json, now } from "./types";

interface CleanupFilter {
  module: string;
  timeFilter?: "all" | "7d" | "30d" | "90d";
  agentId?: number | null;
  targetType?: string | null;
}

function buildWhereClause(filter: CleanupFilter): { sql: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];
  const currentTime = now();

  // Time filter
  if (filter.timeFilter === "7d") {
    clauses.push("created_at < ?");
    params.push(currentTime - 7 * 86400);
  } else if (filter.timeFilter === "30d") {
    clauses.push("created_at < ?");
    params.push(currentTime - 30 * 86400);
  } else if (filter.timeFilter === "90d") {
    clauses.push("created_at < ?");
    params.push(currentTime - 90 * 86400);
  }

  // Agent filter
  if (filter.agentId) {
    if (["chat_records", "agent_memories", "delayed_messages", "context_access_logs", "api_usage_logs"].includes(filter.module)) {
      clauses.push("agent_id = ?");
      params.push(filter.agentId);
    } else if (filter.module === "moments") {
      clauses.push("author_type = 'agent' AND author_id = ?");
      params.push(filter.agentId);
    } else if (["comments", "likes"].includes(filter.module)) {
      clauses.push("actor_type = 'agent' AND actor_id = ?");
      params.push(filter.agentId);
    }
  }

  // Type filter
  if (filter.targetType) {
    if (filter.module === "agent_memories") {
      clauses.push("memory_type = ?");
      params.push(filter.targetType);
    } else if (filter.module === "system_logs") {
      clauses.push("level = ?");
      params.push(filter.targetType);
    }
  }

  const sql = clauses.length > 0 ? " WHERE " + clauses.join(" AND ") : "";
  return { sql, params };
}

const MODULE_TABLE_MAP: Record<string, string[]> = {
  api_logs: ["api_usage_logs", "api_backend_call_details"],
  context_logs: ["context_access_logs"],
  memories: ["agent_memories"],
  chats: ["chat_records"],
  moments: ["moments"],
  comments: ["comments"],
  likes: ["likes"],
  delayed_messages: ["delayed_messages"],
  system_logs: ["system_logs"],
  token_stats: ["token_daily_stats"]
};

export async function previewCleanup(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const filter = await req.json().catch(() => ({})) as CleanupFilter;
  const moduleKey = filter.module;
  const tables = MODULE_TABLE_MAP[moduleKey];

  if (!tables) {
    return json({ error: `不支持的模块: ${moduleKey}` }, 400);
  }

  let totalEstimated = 0;
  const breakdown: Record<string, number> = {};

  for (const table of tables) {
    if (table === "token_daily_stats") {
      const res = await env.DB.prepare("SELECT COUNT(*) AS c FROM token_daily_stats").first<{ c: number }>();
      const count = Number(res?.c) || 0;
      totalEstimated += count;
      breakdown[table] = count;
      continue;
    }

    const { sql, params } = buildWhereClause({ ...filter, module: table });
    const countSql = `SELECT COUNT(*) AS c FROM ${table} ${sql}`;
    const res = await env.DB.prepare(countSql).bind(...params).first<{ c: number }>();
    const count = Number(res?.c) || 0;
    totalEstimated += count;
    breakdown[table] = count;
  }

  return json({
    ok: true,
    module: moduleKey,
    estimated_count: totalEstimated,
    breakdown
  });
}

export async function executeCleanup(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const filter = await req.json().catch(() => ({})) as CleanupFilter;
  const moduleKey = filter.module;
  const tables = MODULE_TABLE_MAP[moduleKey];

  if (!tables) {
    return json({ error: `不支持的模块: ${moduleKey}` }, 400);
  }

  let totalDeleted = 0;
  const breakdown: Record<string, number> = {};

  for (const table of tables) {
    if (table === "token_daily_stats") {
      const res = await env.DB.prepare("DELETE FROM token_daily_stats").run();
      const count = Number(res.meta.rows_written || 0);
      totalDeleted += count;
      breakdown[table] = count;
      continue;
    }

    const { sql, params } = buildWhereClause({ ...filter, module: table });
    const deleteSql = `DELETE FROM ${table} ${sql}`;
    const res = await env.DB.prepare(deleteSql).bind(...params).run();
    const count = Number(res.meta.rows_written || 0);
    totalDeleted += count;
    breakdown[table] = count;
  }

  return json({
    ok: true,
    module: moduleKey,
    deleted_count: totalDeleted,
    breakdown
  });
}
