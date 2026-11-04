export interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  PROBE_SECRET: string;
  SESSION_SIGNING_SECRET?: string;
  APP_NAME?: string;
  SESSION_TTL_HOURS?: string;
  PROBE_MIN_INTERVAL_SECONDS?: string;
}
export interface Agent {
  id:number; name:string; persona:string; force_prompt:string; avatar_url:string;
  enabled:number; auto_post_enabled:number; auto_interact_enabled:number;
  respond_to_user_like:number; allow_agent_interactions:number; activity_level:string;
  interaction_probability:number; min_action_interval_minutes:number;
  daily_api_limit:number; daily_post_limit:number; last_action_at:number; last_post_time:number;
}
export interface Backend {
  id:number; name:string; base_url:string; api_key:string; model:string; enabled:number;
  priority:number; timeout_ms:number; failure_count:number; cooldown_until:number;
}
export const json = (data:unknown, status=200) => new Response(JSON.stringify(data), {
  status, headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
});
export const now = () => Math.floor(Date.now()/1000);
export const uid = () => crypto.randomUUID();
