import type { Env, Backend, Agent } from "./types";
import { now } from "./types";

type Msg={role:"system"|"user"|"assistant";content:string};

async function getBackends(env:Env):Promise<Backend[]> {
  const r=await env.DB.prepare("SELECT * FROM ai_backends WHERE enabled=1 AND cooldown_until<? ORDER BY priority ASC,id ASC").bind(now()).all<Backend>();
  return r.results || [];
}
async function callOne(b:Backend,messages:Msg[]):Promise<string> {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(3000,Math.min(b.timeout_ms||30000,90000)));
  try {
    const base=b.base_url.replace(/\/+$/,"");
    const response=await fetch(`${base}/chat/completions`,{
      method:"POST", signal:controller.signal,
      headers:{"content-type":"application/json","authorization":`Bearer ${b.api_key}`},
      body:JSON.stringify({model:b.model,messages,temperature:0.8})
    });
    if(!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
    const data:any=await response.json();
    const content=data?.choices?.[0]?.message?.content;
    if(typeof content!=="string" || !content.trim()) throw new Error("模型返回内容为空或格式不兼容");
    return content.trim();
  } finally { clearTimeout(timer); }
}
export async function askAI(env:Env, agent:Agent, purpose:string, userContent:string, extraContext=""):Promise<{text:string;backendId:number}> {
  const settings=await env.DB.prepare("SELECT * FROM settings WHERE id=1").first<any>();
  const mem=await env.DB.prepare("SELECT content FROM agent_memories WHERE agent_id=? AND source NOT LIKE 'moment-response:%' ORDER BY importance DESC,updated_at DESC LIMIT 12").bind(agent.id).all<{content:string}>();
  const profile=await env.DB.prepare("SELECT profile_text FROM agent_profiles WHERE agent_id=?").bind(agent.id).first<any>();
  const history=await env.DB.prepare("SELECT role,content FROM chat_records WHERE agent_id=? ORDER BY id DESC LIMIT ?").bind(agent.id,Math.max(0,Math.min(40,settings?.max_context_count||20))).all<any>();
  const timeline=await env.DB.prepare(`SELECT m.id,m.author_type,m.author_id,m.content,m.created_at,
    CASE WHEN m.author_type='user' THEN '我' ELSE COALESCE(a.name,'已删除的智能体') END AS author_name
    FROM moments m LEFT JOIN agents a ON a.id=m.author_id ORDER BY m.id DESC LIMIT 12`).all<any>();
  const momentIds=(timeline.results||[]).map((x:any)=>Number(x.id)).filter(Boolean);
  let socialContext="";
  if(momentIds.length){
    const placeholders=momentIds.map(()=>"?").join(",");
    const comments=await env.DB.prepare(`SELECT c.moment_id,c.content,c.actor_type,c.actor_id,
      CASE WHEN c.actor_type='user' THEN '我' ELSE COALESCE(a.name,'智能体') END AS actor_name
      FROM comments c LEFT JOIN agents a ON a.id=c.actor_id WHERE c.moment_id IN (${placeholders}) ORDER BY c.id DESC LIMIT 24`).bind(...momentIds).all<any>();
    const commentMap=new Map<number,string[]>();
    for(const c of comments.results||[]){const list=commentMap.get(Number(c.moment_id))||[];list.push(`${c.actor_name}：${c.content}`);commentMap.set(Number(c.moment_id),list);}
    socialContext=(timeline.results||[]).reverse().map((m:any)=>`#${m.id} ${m.author_name}：${m.content}${(commentMap.get(Number(m.id))||[]).length?`\n评论：${(commentMap.get(Number(m.id))||[]).join('；')}`:''}`).join("\n");
  }
  const globalPrompt=String(settings?.global_system_prompt||"");
  const memory=(mem.results||[]).map(x=>x.content).join("\n");
  const persona=`智能体名称：${agent.name}\n基础人设：${agent.persona}\n强制行为指令：${agent.force_prompt}\n宿主认知：${profile?.profile_text||""}\n仅属于本智能体的长期记忆：\n${memory}\n近期朋友圈与互动记忆（供本智能体理解关系和上下文）：\n${socialContext}`;
  const rules=settings?.enable_context_compress ? String(settings.compress_rule||"") : "";
  const messages:Msg[]=[
    {role:"system",content:[globalPrompt,persona,rules,`当前任务：${purpose}`].filter(Boolean).join("\n\n")},
    ...(history.results||[]).reverse().map((x:any)=>({role:x.role,content:x.content})).filter((x:any)=>x.role==="user"||x.role==="assistant"),
    {role:"user",content:[extraContext,userContent].filter(Boolean).join("\n\n")}
  ];
  const backends=await getBackends(env);
  if(!backends.length) throw new Error("没有可用的 API 后端，请检查接口配置或冷却状态");
  let last="未知错误";
  for(const b of backends) {
    try {
      const text=await callOne(b,messages);
      await env.DB.prepare("UPDATE ai_backends SET failure_count=0,cooldown_until=0,last_error='',last_success_at=? WHERE id=?").bind(now(),b.id).run();
      await env.DB.prepare("INSERT INTO api_usage_logs(agent_id,backend_id,purpose,success) VALUES(?,?,?,1)").bind(agent.id,b.id,purpose).run();
      return {text,backendId:b.id};
    } catch(e) {
      last=String(e);
      const failures=(b.failure_count||0)+1;
      const cooldown=now()+Math.min(1800,30*Math.pow(2,Math.min(failures,6)));
      await env.DB.prepare("UPDATE ai_backends SET failure_count=?,cooldown_until=?,last_error=? WHERE id=?").bind(failures,cooldown,last.slice(0,500),b.id).run();
      await env.DB.prepare("INSERT INTO api_usage_logs(agent_id,backend_id,purpose,success,error_text) VALUES(?,?,?,0,?)").bind(agent.id,b.id,purpose,last.slice(0,500)).run();
    }
  }
  throw new Error(`所有 API 后端均调用失败：${last}`);
}
export async function maybeExtractMemory(env:Env, agent:Agent, conversation:string) {
  // 低成本策略：只有每 20 条用户消息触发一次；可由管理员调整代码常量。
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM chat_records WHERE agent_id=? AND role='user'").bind(agent.id).first<any>();
  if((Number(count?.n)||0)%20!==0) return;
  try {
    const result=await askAI(env,agent,"memory_extract","请从以下对话中提取最多 3 条长期有价值、稳定且明确的事实。没有则返回 NONE。只输出 JSON 数组，元素为 {content,importance}。\n"+conversation.slice(-3500));
    const raw=result.text.replace(/^```json\s*/i,"").replace(/```$/,"").trim();
    const items=JSON.parse(raw);
    if(Array.isArray(items)) for(const item of items.slice(0,3)) {
      if(typeof item.content==="string" && item.content.trim()) await env.DB.prepare(
        "INSERT INTO agent_memories(agent_id,memory_type,content,importance,source) VALUES(?,?,?,?,?)"
      ).bind(agent.id,"fact",item.content.slice(0,500),Math.max(1,Math.min(5,Number(item.importance)||3)),"ai").run();
    }
  } catch { /* 记忆提取失败不得影响正常聊天 */ }
}
