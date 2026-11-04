import type { Env } from "./types";
import { json } from "./types";
import { login, logout, requireAuth } from "./auth";
import { loginPage, chatPage, momentsPage, settingsPage } from "./view";
import { sendChat,listAgents,saveAgent,deleteAgent,momentsGet,createMoment,likeMoment,commentMoment,settingsGet,settingsSave,backendSave,memoryRoutes } from "./modules";
import { probeHttp,runProbe } from "./probe";
import { exportData,importData } from "./export";

async function history(env:Env,id:number){const r=await env.DB.prepare("SELECT role,content,status,created_at FROM chat_records WHERE agent_id=? ORDER BY id LIMIT 300").bind(id).all();return json(r.results||[]);}
function setupPage(){return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>部署成功 · 等待初始化</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;color:#1d1d1f;margin:0;padding:48px 20px}.card{max-width:760px;margin:6vh auto;background:white;border:1px solid #e5e5e7;border-radius:20px;padding:32px;box-shadow:0 12px 40px #0000000a}h1{font-size:26px}li{margin:12px 0;line-height:1.6}code{background:#f1f1f4;padding:3px 6px;border-radius:5px} .ok{color:#16834a;font-weight:700}</style><main class="card"><div class="ok">✓ Worker 已成功部署</div><h1>还差最后一步：配置 Cloudflare 资源</h1><p>这是首次部署页面。当前 Worker 尚未绑定 D1 数据库，因此业务功能暂未启用。请按以下顺序在 Cloudflare 控制台完成初始化：</p><ol><li>进入本 Worker 的 <b>Settings → Bindings</b>，添加 D1 database，变量名称填写 <code>DB</code>，选择或新建数据库。</li><li>进入 D1 数据库的 SQL Console，执行项目 GitHub 仓库中的 <code>migrations/0001_init.sql</code>。</li><li>进入 Worker 的 <b>Settings → Variables and Secrets</b>，添加 Secrets：<code>ADMIN_PASSWORD</code>（管理员登录密码）和 <code>PROBE_SECRET</code>（随机长密钥）。</li><li>可选添加变量：<code>APP_NAME</code>、<code>SESSION_TTL_HOURS</code>、<code>PROBE_MIN_INTERVAL_SECONDS</code>。</li><li>保存配置并重新部署/重启 Worker，然后刷新本页面，即可进入登录界面。</li></ol><p>无需修改 GitHub 代码，也无需在首次部署前创建 D1 或填写 Database ID。</p></main></html>`;}

export default {
 async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  // First deployment intentionally has no D1 binding. Show setup instructions
  // instead of touching DB until the operator adds the DB binding in Dashboard.
  if(!env.DB) return new Response(setupPage(),{status:200,headers:{"content-type":"text/html;charset=utf-8","cache-control":"no-store"}});
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==="/login"&&method==="GET")return new Response(loginPage(),{headers:{"content-type":"text/html;charset=utf-8"}});
  if(path==="/login"&&method==="POST")return login(request,env);
  if(path==="/logout"&&method==="POST")return logout(env,request);
  if(path==="/api/probe"&&method==="GET")return probeHttp(request,env);
  if(!(await requireAuth(request,env))){
    if(path.startsWith("/api/"))return json({error:"unauthorized"},401);
    return Response.redirect(new URL("/login",url),302);
  }
  if(path==="/chat"||path==="/")return new Response(chatPage(),{headers:{"content-type":"text/html;charset=utf-8"}});
  if(path==="/moments")return new Response(momentsPage(),{headers:{"content-type":"text/html;charset=utf-8"}});
  if(path==="/profile/settings")return new Response(settingsPage(),{headers:{"content-type":"text/html;charset=utf-8"}});
  if(path==="/api/agents"&&method==="GET")return listAgents(env);
  if(path==="/api/agents"&&method==="POST")return saveAgent(request,env);
  const agentMatch = path.match(/^\/api\/agents\/(\d+)$/);
  if(agentMatch&&method==="DELETE")return deleteAgent(Number(agentMatch[1]),env);
  const memoryMatch = path.match(/^\/api\/agents\/(\d+)\/memories$/);
  if(memoryMatch)return memoryRoutes(request,env,Number(memoryMatch[1]));
  if(path==="/api/sendChat"&&method==="POST")return sendChat(request,env);
  if(path==="/api/chat/history"&&method==="GET")return history(env,Number(url.searchParams.get("agentId")));
  if(path==="/api/moments"&&method==="GET")return momentsGet(env);
  if(path==="/api/moments"&&method==="POST")return createMoment(request,env,ctx);
  if(path==="/api/moments/like"&&method==="POST")return likeMoment(request,env);
  if(path==="/api/moments/comment"&&method==="POST")return commentMoment(request,env);
  if(path==="/api/settings"&&method==="GET")return settingsGet(env);
  if(path==="/api/settings"&&method==="POST")return settingsSave(request,env);
  if(path==="/api/backends"&&method==="POST")return backendSave(request,env);
  if(path==="/api/export"&&method==="GET")return exportData(env);
  if(path==="/api/import"&&method==="POST")return importData(request,env);
  return json({error:"Not found"},404);
 },
 async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext){
  if(!env.DB)return;
  ctx.waitUntil(runProbe(env));
 }
} satisfies ExportedHandler<Env>;
