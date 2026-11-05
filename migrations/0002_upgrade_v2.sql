-- 增量迁移：从 V1 升级到 V2，确保不破坏既有数据

PRAGMA foreign_keys = ON;

-- 扩展 users 表
ALTER TABLE users ADD COLUMN wechat_id TEXT NOT NULL DEFAULT 'host_user';
ALTER TABLE users ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch());

-- 扩展 settings 表
ALTER TABLE settings ADD COLUMN default_message_policy TEXT NOT NULL DEFAULT 'rethink';
ALTER TABLE settings ADD COLUMN delayed_message_policy TEXT NOT NULL DEFAULT 'rethink';
ALTER TABLE settings ADD COLUMN max_delay_seconds INTEGER NOT NULL DEFAULT 300;
ALTER TABLE settings ADD COLUMN token_budget_daily INTEGER NOT NULL DEFAULT 100000;

-- 扩展 agents 表
ALTER TABLE agents ADD COLUMN wechat_id TEXT NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN habits TEXT NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN interests TEXT NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN values_text TEXT NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN remark TEXT NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN group_name TEXT NOT NULL DEFAULT '我的AI好友';
ALTER TABLE agents ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN is_muted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch());

-- 扩展 agent_profiles 表
ALTER TABLE agent_profiles ADD COLUMN personality TEXT NOT NULL DEFAULT '随和温柔，富于同理心';
ALTER TABLE agent_profiles ADD COLUMN emotional_tendency TEXT NOT NULL DEFAULT '温和积极';
ALTER TABLE agent_profiles ADD COLUMN social_proactivity TEXT NOT NULL DEFAULT '中等偏主动';
ALTER TABLE agent_profiles ADD COLUMN language_style TEXT NOT NULL DEFAULT '自然生活化，口吻亲切';
ALTER TABLE agent_profiles ADD COLUMN forbidden_items TEXT NOT NULL DEFAULT '禁止虚构现实相遇事实，禁止越权调用未授权接口';
ALTER TABLE agent_profiles ADD COLUMN dedicated_prompt TEXT NOT NULL DEFAULT '';

-- 扩展 chat_records 表
ALTER TABLE chat_records ADD COLUMN is_read_by_host INTEGER NOT NULL DEFAULT 1;
ALTER TABLE chat_records ADD COLUMN is_read_by_ai INTEGER NOT NULL DEFAULT 1;

-- 扩展 ai_backends 表
ALTER TABLE ai_backends ADD COLUMN default_model TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_backends ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 2;

-- 扩展 moments 表
ALTER TABLE moments ADD COLUMN images_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE moments ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE moments ADD COLUMN visibility_agents_json TEXT NOT NULL DEFAULT '[]';

-- 扩展 comments 表
ALTER TABLE comments ADD COLUMN reply_to_actor_type TEXT;
ALTER TABLE comments ADD COLUMN reply_to_actor_id INTEGER;

-- 扩展 api_usage_logs 表
ALTER TABLE api_usage_logs ADD COLUMN model TEXT NOT NULL DEFAULT '';
ALTER TABLE api_usage_logs ADD COLUMN prompt_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE api_usage_logs ADD COLUMN completion_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE api_usage_logs ADD COLUMN total_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE api_usage_logs ADD COLUMN estimated_cost REAL NOT NULL DEFAULT 0.0;
ALTER TABLE api_usage_logs ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0;

-- 新建 V2 专属数据表
CREATE TABLE IF NOT EXISTS agent_preferences (
  agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  host_impression TEXT NOT NULL DEFAULT '初次结识，尚在相互了解中',
  familiarity_level INTEGER NOT NULL DEFAULT 10,
  relation_status TEXT NOT NULL DEFAULT '普通朋友',
  emotional_progress REAL NOT NULL DEFAULT 0.1,
  recent_relation_changes TEXT NOT NULL DEFAULT '新建立好友关系',
  relation_summary TEXT NOT NULL DEFAULT '关系融洽，期待更多交流',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS agent_context_permissions (
  agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  credential_token TEXT NOT NULL UNIQUE,
  perm_time INTEGER NOT NULL DEFAULT 1,
  perm_timezone INTEGER NOT NULL DEFAULT 1,
  perm_device INTEGER NOT NULL DEFAULT 0,
  perm_location INTEGER NOT NULL DEFAULT 0,
  perm_weather INTEGER NOT NULL DEFAULT 0,
  perm_host_profile INTEGER NOT NULL DEFAULT 1,
  perm_host_moments INTEGER NOT NULL DEFAULT 1,
  perm_other_agents INTEGER NOT NULL DEFAULT 1,
  perm_other_moments INTEGER NOT NULL DEFAULT 1,
  perm_social_graph INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 100,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ai_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backend_id INTEGER NOT NULL REFERENCES ai_backends(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  task_types TEXT NOT NULL DEFAULT 'chat,moment,memory,probe',
  token_cost_prompt REAL NOT NULL DEFAULT 0.0,
  token_cost_completion REAL NOT NULL DEFAULT 0.0,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(backend_id, model_name)
);

CREATE TABLE IF NOT EXISTS agent_model_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  backend_id INTEGER REFERENCES ai_backends(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(agent_id, model_name)
);

CREATE TABLE IF NOT EXISTS agent_read_state (
  agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  last_read_host_msg_id INTEGER NOT NULL DEFAULT 0,
  last_read_ai_msg_id INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS delayed_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  sequence_index INTEGER NOT NULL DEFAULT 0,
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  trigger_at INTEGER NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','cancelled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS moment_visibility (
  moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  is_visible INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(moment_id, agent_id)
);

CREATE TABLE IF NOT EXISTS api_backend_call_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backend_id INTEGER NOT NULL REFERENCES ai_backends(id) ON DELETE CASCADE,
  agent_id INTEGER,
  model TEXT NOT NULL DEFAULT '',
  request_type TEXT NOT NULL DEFAULT 'chat',
  request_id TEXT NOT NULL DEFAULT '',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0.0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS context_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  categories_requested TEXT NOT NULL,
  categories_granted TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS token_daily_stats (
  date TEXT PRIMARY KEY,
  total_calls INTEGER NOT NULL DEFAULT 0,
  success_calls INTEGER NOT NULL DEFAULT 0,
  fail_calls INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO schema_migrations(version) VALUES(2);
