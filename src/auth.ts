import type { Env } from "./types";
import { json, now, uid } from "./types";

export async function login(request:Request, env:Env):Promise<Response> {
  if (!env.DB) return json({error:"请先在 Cloudflare 中添加 DB 数据库绑定"},503);
  const body = await request.json().catch(()=>({})) as {password?:string};
  if (!env.ADMIN_PASSWORD) return json({error:"服务器尚未配置 ADMIN_PASSWORD"},503);
  if (!body.password || body.password !== env.ADMIN_PASSWORD) return json({error:"密码错误"},401);
  const id = uid();
  const ttl = Math.max(1, Number(env.SESSION_TTL_HOURS || 168)) * 3600;
  await env.DB.prepare("INSERT INTO sessions(id,expires_at) VALUES(?,?)").bind(id,now()+ttl).run();
  return new Response(JSON.stringify({ok:true}), {
    headers: {
      "content-type":"application/json",
      "set-cookie":`session=${id}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ttl}`
    }
  });
}
export async function requireAuth(request:Request, env:Env):Promise<boolean> {
  if (!env.DB) return false;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)session=([A-Za-z0-9-]+)/);
  if (!match) return false;
  const row = await env.DB.prepare("SELECT id FROM sessions WHERE id=? AND expires_at>?").bind(match[1],now()).first();
  return !!row;
}
export async function logout(env:Env, request:Request):Promise<Response> {
  if (!env.DB) return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json"}});
  const cookie=request.headers.get("Cookie")||"";
  const m=cookie.match(/(?:^|;\s*)session=([A-Za-z0-9-]+)/);
  if(m) await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(m[1]).run();
  return new Response(JSON.stringify({ok:true}),{headers:{
    "content-type":"application/json","set-cookie":"session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
  }});
}
