export interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  PROBE_SECRET?: string;
  SESSION_SIGNING_SECRET?: string;
  APP_NAME?: string;
  SESSION_TTL_HOURS?: string;
  PROBE_MIN_INTERVAL_SECONDS?: string;
}

export interface User {
  id: number;
  nickname: string;
  wechat_id: string;
  signature: string;
  avatar_url: string;
  chat_background_url: string;
  moments_background_url: string;
  created_at: number;
  updated_at: number;
}

export interface Settings {
  id: number;
  global_system_prompt: string;
  default_message_policy: string;
  delayed_message_policy: string;
  max_delay_seconds: number;
  max_context_count: number;
  enable_context_compress: number;
  compress_rule: string;
  probe_enabled: number;
  probe_min_interval_seconds: number;
  token_budget_daily: number;
  export_version: number;
  updated_at: number;
}

export interface Agent {
  id: number;
  name: string;
  wechat_id: string;
  avatar_url: string;
  persona: string;
  force_prompt: string;
  habits: string;
  interests: string;
  values_text: string;
  remark: string;
  group_name: string;
  is_starred: number;
  is_pinned: number;
  is_muted: number;
  enabled: number;
  auto_post_enabled: number;
  auto_interact_enabled: number;
  respond_to_user_like: number;
  allow_agent_interactions: number;
  activity_level: string;
  interaction_probability: number;
  min_action_interval_minutes: number;
  daily_api_limit: number;
  daily_post_limit: number;
  last_action_at: number;
  last_post_time: number;
  created_at: number;
  updated_at: number;
}

export interface AgentPreference {
  agent_id: number;
  host_impression: string;
  familiarity_level: number;
  relation_status: string;
  emotional_progress: number;
  recent_relation_changes: string;
  relation_summary: string;
  updated_at: number;
}

export interface AgentProfile {
  agent_id: number;
  personality: string;
  emotional_tendency: string;
  social_proactivity: string;
  language_style: string;
  forbidden_items: string;
  dedicated_prompt: string;
  profile_text: string;
  updated_at: number;
}

export interface AgentMemory {
  id: number;
  agent_id: number;
  memory_type: 'long_term' | 'fact' | 'relation' | 'event' | 'moment' | 'emotion' | 'preference' | 'system';
  content: string;
  importance: number;
  source: string;
  created_at: number;
  updated_at: number;
}

export interface AgentContextPermission {
  agent_id: number;
  credential_token: string;
  perm_time: number;
  perm_timezone: number;
  perm_device: number;
  perm_location: number;
  perm_weather: number;
  perm_host_profile: number;
  perm_host_moments: number;
  perm_other_agents: number;
  perm_other_moments: number;
  perm_social_graph: number;
  daily_limit: number;
  updated_at: number;
}

export interface AgentInteractionRule {
  id: number;
  agent_id: number;
  target_agent_id: number;
  allow_interact: number;
  allow_view_moments: number;
  allow_like: number;
  allow_comment: number;
  updated_at: number;
}

export interface Backend {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  default_model: string;
  enabled: number;
  priority: number;
  timeout_ms: number;
  retry_count: number;
  failure_count: number;
  cooldown_until: number;
  last_error: string;
  last_success_at: number;
  created_at: number;
}

export interface AIModel {
  id: number;
  backend_id: number;
  model_name: string;
  enabled: number;
  priority: number;
  task_types: string;
  token_cost_prompt: number;
  token_cost_completion: number;
  timeout_ms: number;
  created_at: number;
}

export interface ChatRecord {
  id: number;
  message_uid: string;
  agent_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: string;
  is_read_by_host: number;
  is_read_by_ai: number;
  created_at: number;
}

export interface DelayedMessage {
  id: number;
  agent_id: number;
  plan_id: string;
  sequence_index: number;
  delay_seconds: number;
  trigger_at: number;
  content: string;
  status: 'pending' | 'sent' | 'cancelled';
  created_at: number;
  sent_at: number;
}

export interface Moment {
  id: number;
  author_type: 'user' | 'agent';
  author_id: number | null;
  content: string;
  images_json: string;
  background_url: string;
  visibility: 'public' | 'private' | 'whitelist' | 'blacklist' | 'host_only';
  visibility_agents_json: string;
  created_at: number;
  author_name?: string;
  author_avatar?: string;
  like_count?: number;
  comment_count?: number;
  is_liked_by_host?: boolean;
  blocked_host?: boolean;
  likes?: Like[];
  comments?: Comment[];
}

export interface Like {
  id: number;
  moment_id: number;
  actor_type: 'user' | 'agent';
  actor_id: number;
  created_at: number;
  actor_name?: string;
  actor_avatar?: string;
}

export interface Comment {
  id: number;
  moment_id: number;
  actor_type: 'user' | 'agent';
  actor_id: number;
  parent_id: number | null;
  reply_to_actor_type: string | null;
  reply_to_actor_id: number | null;
  content: string;
  created_at: number;
  actor_name?: string;
  actor_avatar?: string;
  reply_to_name?: string;
}

export interface ApiUsageLog {
  id: number;
  agent_id: number | null;
  backend_id: number | null;
  model: string;
  purpose: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  duration_ms: number;
  success: number;
  error_text: string;
  created_at: number;
}

export interface ApiBackendCallDetail {
  id: number;
  backend_id: number;
  agent_id: number | null;
  model: string;
  request_type: string;
  request_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  duration_ms: number;
  success: number;
  error_message: string;
  created_at: number;
}

export interface ContextAccessLog {
  id: number;
  agent_id: number;
  categories_requested: string;
  categories_granted: string;
  ip: string;
  duration_ms: number;
  success: number;
  error_message: string;
  created_at: number;
}

export interface TokenDailyStat {
  date: string;
  total_calls: number;
  success_calls: number;
  fail_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });

export const now = () => Math.floor(Date.now() / 1000);
export const uid = () => crypto.randomUUID();
export const todayString = () => new Date().toISOString().slice(0, 10);
