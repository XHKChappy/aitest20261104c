import type { Env } from "./types";
import { json } from "./types";

const ALL_TABLES = [
  "users",
  "settings",
  "agents",
  "agent_preferences",
  "agent_profiles",
  "agent_memories",
  "agent_context_permissions",
  "agent_interaction_rules",
  "ai_backends",
  "ai_models",
  "agent_model_permissions",
  "chat_records",
  "delayed_messages",
  "moments",
  "likes",
  "comments",
  "probe_tasks"
];

export async function exportData(env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const data: any = {
    format: "ai-wechat-moments",
    version: 2,
    exportedAt: new Date().toISOString(),
    tables: {}
  };

  for (const table of ALL_TABLES) {
    try {
      const rows = await env.DB.prepare(`SELECT * FROM ${table}`).all<any>();
      if (table === "ai_backends") {
        // Exclude secret API keys from export for security
        data.tables[table] = (rows.results || []).map((x: any) => ({ ...x, api_key: "" }));
      } else {
        data.tables[table] = rows.results || [];
      }
    } catch {
      data.tables[table] = [];
    }
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="ai-wechat-backup-v2.json"',
      "cache-control": "no-store"
    }
  });
}

export async function importData(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const data = await req.json().catch(() => null) as any;
  if (!data || data.format !== "ai-wechat-moments" || !data.tables) {
    return json({ error: "备份文件格式或结构不正确" }, 400);
  }

  // Deletion order to respect foreign key constraints
  const deleteOrder = [
    "comments",
    "likes",
    "delayed_messages",
    "chat_records",
    "agent_memories",
    "agent_preferences",
    "agent_profiles",
    "agent_context_permissions",
    "agent_interaction_rules",
    "agent_model_permissions",
    "ai_models",
    "ai_backends",
    "moments",
    "probe_tasks",
    "agents",
    "settings",
    "users"
  ];

  for (const t of deleteOrder) {
    try {
      await env.DB.prepare(`DELETE FROM ${t}`).run();
    } catch {}
  }

  // Insertion order
  const insertOrder = [
    "users",
    "settings",
    "agents",
    "agent_preferences",
    "agent_profiles",
    "agent_memories",
    "agent_context_permissions",
    "agent_interaction_rules",
    "ai_backends",
    "ai_models",
    "agent_model_permissions",
    "moments",
    "probe_tasks",
    "chat_records",
    "delayed_messages",
    "likes",
    "comments"
  ];

  for (const t of insertOrder) {
    const rows = data.tables[t] || [];
    for (const row of rows) {
      const cols = Object.keys(row).filter(k => /^[a-z0-9_]+$/i.test(k));
      if (!cols.length) continue;
      const placeholders = cols.map(() => "?").join(",");
      const sql = `INSERT OR REPLACE INTO ${t}(${cols.join(",")}) VALUES(${placeholders})`;
      try {
        await env.DB.prepare(sql).bind(...cols.map(c => row[c])).run();
      } catch (e: any) {
        console.warn(`Failed to import row into ${t}:`, e.message);
      }
    }
  }

  return json({
    ok: true,
    warning: "数据已成功导入并恢复。API Key 与管理会话未导入，请前往设置重新填写 API Key。"
  });
}
