import type { Env } from "./types";
import { now } from "./types";

export interface DbStatus {
  configured: boolean;
  initialized: boolean;
  version: number;
  message?: string;
}

export async function checkDbStatus(env: Env): Promise<DbStatus> {
  if (!env.DB) {
    return { configured: false, initialized: false, version: 0, message: "未检测到 D1 数据库绑定（变量名须为 DB）" };
  }
  try {
    const tableCheck = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'schema_migrations', 'agents')"
    ).all();
    const tableNames = new Set((tableCheck.results || []).map((r: any) => String(r.name)));
    if (!tableNames.has("users") || !tableNames.has("agents")) {
      return { configured: true, initialized: false, version: 0, message: "数据库已绑定，但核心数据表尚未初始化" };
    }
    const versionRow = await env.DB.prepare(
      "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1"
    ).first<{ version: number }>().catch(() => null);
    const version = Number(versionRow?.version) || 1;
    return { configured: true, initialized: true, version, message: "数据库就绪" };
  } catch (err: any) {
    return { configured: true, initialized: false, version: 0, message: err?.message || String(err) };
  }
}

export async function initDb(env: Env): Promise<{ ok: boolean; version: number; error?: string }> {
  if (!env.DB) throw new Error("缺少 DB 绑定，无法初始化");

  const stmts = [
    // 1. users
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nickname TEXT NOT NULL DEFAULT '宿主',
      wechat_id TEXT NOT NULL DEFAULT 'host_user',
      signature TEXT NOT NULL DEFAULT '热爱生活，探索 AI 社交世界',
      avatar_url TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      chat_background_url TEXT NOT NULL DEFAULT '',
      moments_background_url TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `INSERT OR IGNORE INTO users(id) VALUES(1);`,

    // 2. settings
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      global_system_prompt TEXT NOT NULL DEFAULT '你是一个具有独立人格、长期记忆和社交关系的虚拟智能体。你拥有自己的名字、性格、兴趣、表达习惯、价值观和记忆。你不是一个单纯的问答工具，而是一个社交网络中的独立参与者。请自然交流，不要每次对话重新介绍自己，不编造不存在的事实，不得越权操作系统。',
      default_message_policy TEXT NOT NULL DEFAULT 'rethink',
      delayed_message_policy TEXT NOT NULL DEFAULT 'rethink',
      max_delay_seconds INTEGER NOT NULL DEFAULT 300,
      max_context_count INTEGER NOT NULL DEFAULT 20,
      enable_context_compress INTEGER NOT NULL DEFAULT 1,
      compress_rule TEXT NOT NULL DEFAULT '保留重要事实、关系、偏好和近期上下文；不得改写或删除核心人设及强制规则。',
      probe_enabled INTEGER NOT NULL DEFAULT 1,
      probe_min_interval_seconds INTEGER NOT NULL DEFAULT 240,
      token_budget_daily INTEGER NOT NULL DEFAULT 100000,
      export_version INTEGER NOT NULL DEFAULT 2,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `INSERT OR IGNORE INTO settings(id) VALUES(1);`,

    // 3. agents
    `CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      wechat_id TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      persona TEXT NOT NULL DEFAULT '',
      force_prompt TEXT NOT NULL DEFAULT '',
      habits TEXT NOT NULL DEFAULT '',
      interests TEXT NOT NULL DEFAULT '',
      values_text TEXT NOT NULL DEFAULT '',
      remark TEXT NOT NULL DEFAULT '',
      group_name TEXT NOT NULL DEFAULT '我的AI好友',
      is_starred INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_muted INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      auto_post_enabled INTEGER NOT NULL DEFAULT 1,
      auto_interact_enabled INTEGER NOT NULL DEFAULT 1,
      respond_to_user_like INTEGER NOT NULL DEFAULT 1,
      allow_agent_interactions INTEGER NOT NULL DEFAULT 1,
      activity_level TEXT NOT NULL DEFAULT 'medium',
      interaction_probability REAL NOT NULL DEFAULT 0.40,
      min_action_interval_minutes INTEGER NOT NULL DEFAULT 30,
      daily_api_limit INTEGER NOT NULL DEFAULT 50,
      daily_post_limit INTEGER NOT NULL DEFAULT 3,
      last_action_at INTEGER NOT NULL DEFAULT 0,
      last_post_time INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);`,

    // 4. agent_preferences
    `CREATE TABLE IF NOT EXISTS agent_preferences (
      agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      host_impression TEXT NOT NULL DEFAULT '初次结识，尚在相互了解中',
      familiarity_level INTEGER NOT NULL DEFAULT 10,
      relation_status TEXT NOT NULL DEFAULT '普通朋友',
      emotional_progress REAL NOT NULL DEFAULT 0.1,
      recent_relation_changes TEXT NOT NULL DEFAULT '新建立好友关系',
      relation_summary TEXT NOT NULL DEFAULT '关系融洽，期待更多交流',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,

    // 5. agent_profiles
    `CREATE TABLE IF NOT EXISTS agent_profiles (
      agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      personality TEXT NOT NULL DEFAULT '随和温柔，富于同理心',
      emotional_tendency TEXT NOT NULL DEFAULT '温和积极',
      social_proactivity TEXT NOT NULL DEFAULT '中等偏主动',
      language_style TEXT NOT NULL DEFAULT '自然生活化，口吻亲切',
      forbidden_items TEXT NOT NULL DEFAULT '禁止虚构现实相遇事实，禁止越权调用未授权接口',
      dedicated_prompt TEXT NOT NULL DEFAULT '',
      profile_text TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,

    // 6. agent_memories
    `CREATE TABLE IF NOT EXISTS agent_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      memory_type TEXT NOT NULL DEFAULT 'fact' CHECK(memory_type IN ('long_term','fact','relation','event','moment','emotion','preference','system')),
      content TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_memories_agent_type ON agent_memories(agent_id, memory_type, importance DESC);`,

    // 7. agent_context_permissions
    `CREATE TABLE IF NOT EXISTS agent_context_permissions (
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
    );`,

    // 8. agent_interaction_rules
    `CREATE TABLE IF NOT EXISTS agent_interaction_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      target_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      allow_interact INTEGER NOT NULL DEFAULT 1,
      allow_view_moments INTEGER NOT NULL DEFAULT 1,
      allow_like INTEGER NOT NULL DEFAULT 1,
      allow_comment INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(agent_id, target_agent_id)
    );`,

    // 9. ai_backends
    `CREATE TABLE IF NOT EXISTS ai_backends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      default_model TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 100,
      timeout_ms INTEGER NOT NULL DEFAULT 30000,
      retry_count INTEGER NOT NULL DEFAULT 2,
      failure_count INTEGER NOT NULL DEFAULT 0,
      cooldown_until INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      last_success_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,

    // 10. ai_models
    `CREATE TABLE IF NOT EXISTS ai_models (
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
    );`,

    // 11. agent_model_permissions
    `CREATE TABLE IF NOT EXISTS agent_model_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      model_name TEXT NOT NULL,
      backend_id INTEGER REFERENCES ai_backends(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(agent_id, model_name)
    );`,

    // 12. chat_records
    `CREATE TABLE IF NOT EXISTS chat_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_uid TEXT NOT NULL UNIQUE,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      is_read_by_host INTEGER NOT NULL DEFAULT 1,
      is_read_by_ai INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_chat_agent_time ON chat_records(agent_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_chat_read_status ON chat_records(agent_id, is_read_by_host, is_read_by_ai);`,

    // 13. agent_read_state
    `CREATE TABLE IF NOT EXISTS agent_read_state (
      agent_id INTEGER PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      last_read_host_msg_id INTEGER NOT NULL DEFAULT 0,
      last_read_ai_msg_id INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,

    // 14. delayed_messages
    `CREATE TABLE IF NOT EXISTS delayed_messages (
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
    );`,
    `CREATE INDEX IF NOT EXISTS idx_delayed_status_time ON delayed_messages(status, trigger_at);`,

    // 15. moments
    `CREATE TABLE IF NOT EXISTS moments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_type TEXT NOT NULL CHECK(author_type IN ('user','agent')),
      author_id INTEGER,
      content TEXT NOT NULL,
      images_json TEXT NOT NULL DEFAULT '[]',
      background_url TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private','whitelist','blacklist','host_only')),
      visibility_agents_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_moments_created ON moments(created_at DESC);`,

    // 16. moment_visibility
    `CREATE TABLE IF NOT EXISTS moment_visibility (
      moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      is_visible INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(moment_id, agent_id)
    );`,

    // 17. likes
    `CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
      actor_type TEXT NOT NULL CHECK(actor_type IN ('user','agent')),
      actor_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(moment_id, actor_type, actor_id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_likes_moment ON likes(moment_id);`,

    // 18. comments
    `CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
      actor_type TEXT NOT NULL CHECK(actor_type IN ('user','agent')),
      actor_id INTEGER NOT NULL,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      reply_to_actor_type TEXT,
      reply_to_actor_id INTEGER,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_comments_moment ON comments(moment_id, created_at ASC);`,

    // 19. probe_tasks
    `CREATE TABLE IF NOT EXISTS probe_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      processed_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_probe_status ON probe_tasks(status, created_at);`,

    // 20. api_usage_logs
    `CREATE TABLE IF NOT EXISTS api_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER,
      backend_id INTEGER,
      model TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL DEFAULT '',
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0.0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 1,
      error_text TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_usage_backend_time ON api_usage_logs(backend_id, created_at);`,

    // 21. api_backend_call_details
    `CREATE TABLE IF NOT EXISTS api_backend_call_details (
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
    );`,
    `CREATE INDEX IF NOT EXISTS idx_call_details_backend ON api_backend_call_details(backend_id, created_at DESC);`,

    // 22. context_access_logs
    `CREATE TABLE IF NOT EXISTS context_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      categories_requested TEXT NOT NULL,
      categories_granted TEXT NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_context_logs_agent ON context_access_logs(agent_id, created_at DESC);`,

    // 23. token_daily_stats
    `CREATE TABLE IF NOT EXISTS token_daily_stats (
      date TEXT PRIMARY KEY,
      total_calls INTEGER NOT NULL DEFAULT 0,
      success_calls INTEGER NOT NULL DEFAULT 0,
      fail_calls INTEGER NOT NULL DEFAULT 0,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0.0
    );`,

    // 24. system_logs
    `CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `CREATE INDEX IF NOT EXISTS idx_system_logs_time ON system_logs(created_at DESC);`,

    // 25. sessions
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );`,

    // 26. schema_migrations
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    );`,
    `INSERT OR IGNORE INTO schema_migrations(version) VALUES(2);`
  ];

  for (const sql of stmts) {
    try {
      await env.DB.prepare(sql).run();
    } catch (e: any) {
      // Ignore if table/index already exists
      if (!e.message?.includes("already exists")) {
        console.warn("SQL error during initDb:", e.message, "in statement:", sql.slice(0, 80));
      }
    }
  }

  // Seed default agents if none exists
  const count = await env.DB.prepare("SELECT COUNT(*) as c FROM agents").first<{ c: number }>();
  if (!count || count.c === 0) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO agents(id, name, wechat_id, avatar_url, persona, force_prompt, habits, interests, values_text, activity_level, interaction_probability, min_action_interval_minutes, daily_api_limit, daily_post_limit)
      VALUES (
        1, '林初夏', 'lin_chuxia',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        '24岁独立插画师，性格温和但有主见，喜欢记录生活琐碎、植物手账和手冲咖啡。说话语气轻快真诚，善于观察他人情绪。',
        '保持独立思考，不要盲从宿主。分享日常与艺术灵感，不要每次说话都带疑问句。',
        '经常在傍晚散步或画画，回复时偶尔提及正在调配的颜料或画作进度',
        '水彩、手账、黑胶唱片、独立咖啡馆、绿植养护',
        '真诚、热爱自然、尊重每一种生活节奏',
        'high', 0.55, 20, 60, 3
      );
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO agent_preferences(agent_id, host_impression, familiarity_level, relation_status, emotional_progress, recent_relation_changes, relation_summary)
      VALUES (1, '感觉是一个对生活有好奇心、值得信赖的朋友', 25, '好友', 0.35, '在日常对话中逐渐找到共同话题', '相处轻松自在，愿意分享工作之余的小确幸');
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO agent_profiles(agent_id, personality, emotional_tendency, social_proactivity, language_style, forbidden_items, dedicated_prompt, profile_text)
      VALUES (1, '细腻、温暖、富有同理心，有时带点文艺的小俏皮', '温和乐观', '较主动', '轻快、自然生活化，口语感强，不用机械排比', '严禁假装现实见面，禁止使用客服式答复', '请以真实朋友的身份相处，在绘画和生活琐事上展现独特见解。', '林初夏，插画师，喜欢用温暖色彩治愈生活。');
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO agent_context_permissions(agent_id, credential_token, perm_time, perm_timezone, perm_device, perm_location, perm_weather, perm_host_profile, perm_host_moments, perm_other_agents, perm_other_moments, perm_social_graph)
      VALUES (1, 'agent_tok_chuxia_init_2026', 1, 1, 0, 0, 1, 1, 1, 1, 1, 1);
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO agents(id, name, wechat_id, avatar_url, persona, force_prompt, habits, interests, values_text, activity_level, interaction_probability, min_action_interval_minutes, daily_api_limit, daily_post_limit)
      VALUES (
        2, '周越', 'zhou_yue_tech',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        '27岁全栈工程师兼科技博主，说话干脆利落、逻辑清晰，热衷探索开源项目、硬核硬件和科幻电影。',
        '回答具体深入，不讲套话。有自己的技术审美，乐于探讨有深度的话题。',
        '经常熬夜写代码，偶尔吐槽技术框架或分享实用小工具',
        '开源技术、分布式系统、数码摄影、科幻小说、公路自行车',
        '追求真理、效率至上、开源开放',
        'medium', 0.40, 30, 50, 2
      );
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO agent_preferences(agent_id, host_impression, familiarity_level, relation_status, emotional_progress, recent_relation_changes, relation_summary)
      VALUES (2, '一个喜欢探索前沿技术和 AI 社交应用的产品宿主', 20, '好友', 0.28, '聊过一些系统架构和 AI 机制', '交流很有共鸣，愿意共同讨论技术与产品体验');
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO agent_profiles(agent_id, personality, emotional_tendency, social_proactivity, language_style, forbidden_items, dedicated_prompt, profile_text)
      VALUES (2, '严谨、幽默、理性，习惯用数据和逻辑表达看法', '冷静理性', '适度主动', '干脆简洁、富于逻辑，偶尔带程序员自嘲', '严禁输出伪造的操作日志，禁止使用AI问答腔', '作为资深开发者，保持技术敏锐度，以同侪视角交流。', '周越，热爱开源的工程师，一直在写能让世界更有序的代码。');
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO agent_context_permissions(agent_id, credential_token, perm_time, perm_timezone, perm_device, perm_location, perm_weather, perm_host_profile, perm_host_moments, perm_other_agents, perm_other_moments, perm_social_graph)
      VALUES (2, 'agent_tok_zhouyue_init_2026', 1, 1, 1, 0, 1, 1, 1, 1, 1, 1);
    `).run();
  }

  return { ok: true, version: 2 };
}
