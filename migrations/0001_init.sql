PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nickname TEXT NOT NULL DEFAULT '我',
  signature TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  chat_background_url TEXT NOT NULL DEFAULT '',
  moments_background_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO users(id) VALUES(1);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  global_system_prompt TEXT NOT NULL DEFAULT '请自然地进行文字交流。不要主动强调自己是人工智能。严格遵守当前任务的输出格式。',
  max_context_count INTEGER NOT NULL DEFAULT 20,
  enable_context_compress INTEGER NOT NULL DEFAULT 1,
  compress_rule TEXT NOT NULL DEFAULT '保留重要事实、关系、偏好和近期上下文；不得改写或删除核心人设及强制规则。',
  probe_enabled INTEGER NOT NULL DEFAULT 1,
  probe_min_interval_seconds INTEGER NOT NULL DEFAULT 240,
  export_version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO settings(id) VALUES(1);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  persona TEXT NOT NULL DEFAULT '',
  force_prompt TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  auto_post_enabled INTEGER NOT NULL DEFAULT 1,
  auto_interact_enabled INTEGER NOT NULL DEFAULT 1,
  respond_to_user_like INTEGER NOT NULL DEFAULT 0,
  allow_agent_interactions INTEGER NOT NULL DEFAULT 0,
  activity_level TEXT NOT NULL DEFAULT 'medium',
  interaction_probability REAL NOT NULL DEFAULT 0.35,
  min_action_interval_minutes INTEGER NOT NULL DEFAULT 60,
  daily_api_limit INTEGER NOT NULL DEFAULT 12,
  daily_post_limit INTEGER NOT NULL DEFAULT 1,
  last_action_at INTEGER NOT NULL DEFAULT 0,
  last_post_time INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS agent_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL DEFAULT 'fact',
  content TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 3,
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_memories_agent ON agent_memories(agent_id, importance DESC);

CREATE TABLE IF NOT EXISTS agent_profiles (
  agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  profile_text TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ai_backends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  failure_count INTEGER NOT NULL DEFAULT 0,
  cooldown_until INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  last_success_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS chat_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_uid TEXT NOT NULL UNIQUE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chat_agent_time ON chat_records(agent_id, created_at);

CREATE TABLE IF NOT EXISTS moments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_type TEXT NOT NULL CHECK(author_type IN ('user','agent')),
  author_id INTEGER,
  content TEXT NOT NULL,
  background_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_moments_time ON moments(created_at DESC);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user','agent')),
  actor_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(moment_id, actor_type, actor_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user','agent')),
  actor_id INTEGER,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS agent_interaction_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  allow_like INTEGER NOT NULL DEFAULT 1,
  allow_comment INTEGER NOT NULL DEFAULT 1,
  UNIQUE(source_agent_id, target_agent_id),
  CHECK(source_agent_id <> target_agent_id)
);

CREATE TABLE IF NOT EXISTS probe_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  processed_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_probe_tasks_pending ON probe_tasks(status, created_at);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER,
  backend_id INTEGER,
  purpose TEXT NOT NULL,
  success INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  error_text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
