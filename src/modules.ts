import type { Env, Agent } from "./types";
import { json, now, uid } from "./types";
import { askAI, maybeExtractMemory } from "./ai";
import { processUserMomentImmediately } from "./probe";

const body = async (r:Request)=>r.json().catch(()=>({})) as Promise<any>;
const getAgent=async(env:Env,id:number)=>env.DB.prepare("SELECT * FROM agents WHERE id=?").bind(id).first<Agent>();

export async function sendChat(req:Request,env:Env) {
  const b=await body(req), agentId=Number(b.agentId), content=String(b.content||"").trim(), messageUid=String(b.messageUid||uid());
  if(!agentId||!content||content.length>8000) return json({error:"参数错误或消息过长"},400);
  const agent=await getAgent(env,agentId); if(!agent) return json({error:"智能体不存在"},404);
  const existed=await env.DB.prepare("SELECT id,status FROM chat_records WHERE message_uid=?").bind(messageUid).first<any>();
  if(existed) return json({ok:true,duplicate:true,messageId:existed.id});
  await env.DB.prepare("INSERT INTO chat_records(message_uid,agent_id,role,content,status) VALUES(?,?, 'user',?,'sent')").bind(messageUid,agentId,content).run();
  try {
    const result=await askAI(env,agent,"chat",content);
    await env.DB.prepare("INSERT INTO chat_records(message_uid,agent_id,role,content,status) VALUES(?,?, 'assistant',?,'sent')").bind(uid(),agentId,result.text).run();
    const history=await env.DB.prepare("SELECT role,content FROM chat_records WHERE agent_id=? ORDER BY id DESC LIMIT 12").bind(agentId).all<any>();
    await maybeExtractMemory(env,agent,(history.results||[]).reverse().map(x=>`${x.role}: ${x.content}`).join("\n"));
    return json({ok:true,reply:result.text,messageUid});
  } catch(e) {
    await env.DB.prepare("UPDATE chat_records SET status='failed' WHERE message_uid=?").bind(messageUid).run();
    return json({error:String(e),messageUid,retryable:true},502);
  }
}
export async function listAgents(env:Env){const r=await env.DB.prepare("SELECT * FROM agents ORDER BY id").all();return json(r.results||[]);}
export async function saveAgent(req:Request,env:Env){
  const b=await body(req),id=Number(b.id)||0,name=String(b.name||"").trim();
  if(!name)return json({error:"名称不能为空"},400);
  const fields=[name,String(b.persona||""),String(b.force_prompt||""),String(b.avatar_url||""),
    Number(b.enabled??1),Number(b.auto_post_enabled??1),Number(b.auto_interact_enabled??1),
    Number(b.respond_to_user_like??0),Number(b.allow_agent_interactions??0),
    String(b.activity_level||"medium"),Math.max(0,Math.min(1,Number(b.interaction_probability??0.35))),
    Math.max(5,Number(b.min_action_interval_minutes)||60),Math.max(0,Number(b.daily_api_limit??12)),
    Math.max(0,Number(b.daily_post_limit??1))];
  if(id) await env.DB.prepare(`UPDATE agents SET name=?,persona=?,force_prompt=?,avatar_url=?,enabled=?,auto_post_enabled=?,auto_interact_enabled=?,respond_to_user_like=?,allow_agent_interactions=?,activity_level=?,interaction_probability=?,min_action_interval_minutes=?,daily_api_limit=?,daily_post_limit=? WHERE id=?`).bind(...fields,id).run();
  else await env.DB.prepare(`INSERT INTO agents(name,persona,force_prompt,avatar_url,enabled,auto_post_enabled,auto_interact_enabled,respond_to_user_like,allow_agent_interactions,activity_level,interaction_probability,min_action_interval_minutes,daily_api_limit,daily_post_limit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...fields).run();
  return json({ok:true});
}
export async function deleteAgent(id:number,env:Env){await env.DB.prepare("DELETE FROM agents WHERE id=?").bind(id).run();return json({ok:true});}

export async function momentsGet(env:Env){
  const rows=await env.DB.prepare(`SELECT m.*,CASE WHEN m.author_type='user' THEN '我' ELSE a.name END AS author_name,
    (SELECT COUNT(*) FROM likes l WHERE l.moment_id=m.id) AS like_count,
    (SELECT COUNT(*) FROM comments c WHERE c.moment_id=m.id) AS comment_count
    FROM moments m LEFT JOIN agents a ON a.id=m.author_id ORDER BY m.created_at DESC LIMIT 100`).all();
  return json(rows.results||[]);
}
export async function createMoment(req:Request,env:Env,ctx:ExecutionContext){
  const b=await body(req),content=String(b.content||"").trim();
  if(!content||content.length>3000)return json({error:"朋友圈内容不能为空或过长"},400);
  const r=await env.DB.prepare("INSERT INTO moments(author_type,content,background_url) VALUES('user',?,?)").bind(content,String(b.background_url||"")).run();
  const momentId=Number(r.meta.last_row_id);
  // 先入队作为失败补偿，再立即后台触发，不等待 5 分钟 Cron。
  const task=await env.DB.prepare("INSERT INTO probe_tasks(event_type,payload_json) VALUES('user_moment',?)").bind(JSON.stringify({momentId,immediate:true})).run();
  const taskId=Number(task.meta.last_row_id);
  ctx.waitUntil((async()=>{
    const result=await processUserMomentImmediately(env,momentId);
    if(result.failed===0) await env.DB.prepare("UPDATE probe_tasks SET status='done',processed_at=? WHERE id=?").bind(now(),taskId).run();
  })());
  return json({ok:true,id:momentId,triggered:"immediately"});
}
export async function likeMoment(req:Request,env:Env){
  const b=await body(req),momentId=Number(b.momentId);
  if(!momentId)return json({error:"momentId required"},400);
  try{await env.DB.prepare("INSERT INTO likes(moment_id,actor_type,actor_id) VALUES(?,'user',1)").bind(momentId).run();}
  catch{return json({ok:true,alreadyLiked:true});}
  await env.DB.prepare("INSERT INTO probe_tasks(event_type,payload_json) VALUES('user_like',?)").bind(JSON.stringify({momentId})).run();
  return json({ok:true});
}
export async function commentMoment(req:Request,env:Env){
  const b=await body(req),momentId=Number(b.momentId),content=String(b.content||"").trim();
  if(!momentId||!content||content.length>1000)return json({error:"参数错误"},400);
  const r=await env.DB.prepare("INSERT INTO comments(moment_id,actor_type,actor_id,parent_id,content) VALUES(?,'user',1,?,?)").bind(momentId,Number(b.parentId)||null,content).run();
  await env.DB.prepare("INSERT INTO probe_tasks(event_type,payload_json) VALUES('user_comment',?)").bind(JSON.stringify({momentId,commentId:r.meta.last_row_id})).run();
  return json({ok:true,id:r.meta.last_row_id});
}
export async function settingsGet(env:Env){
  const [s,u,b]=await Promise.all([
    env.DB.prepare("SELECT * FROM settings WHERE id=1").first(),
    env.DB.prepare("SELECT * FROM users WHERE id=1").first(),
    env.DB.prepare("SELECT id,name,base_url,model,enabled,priority,timeout_ms,failure_count,cooldown_until,last_error,last_success_at FROM ai_backends ORDER BY priority").all()
  ]);
  return json({settings:s,user:u,backends:b.results||[]});
}
export async function settingsSave(req:Request,env:Env){
  const b=await body(req),s=b.settings||{},u=b.user||{};
  await env.DB.prepare("UPDATE settings SET global_system_prompt=?,max_context_count=?,enable_context_compress=?,compress_rule=?,probe_enabled=?,probe_min_interval_seconds=?,updated_at=? WHERE id=1")
    .bind(String(s.global_system_prompt||""),Math.max(2,Math.min(100,Number(s.max_context_count)||20)),Number(s.enable_context_compress??1),String(s.compress_rule||""),Number(s.probe_enabled??1),Math.max(60,Number(s.probe_min_interval_seconds)||240),now()).run();
  await env.DB.prepare("UPDATE users SET nickname=?,signature=?,avatar_url=?,chat_background_url=?,moments_background_url=? WHERE id=1")
    .bind(String(u.nickname||"我"),String(u.signature||""),String(u.avatar_url||""),String(u.chat_background_url||""),String(u.moments_background_url||"")).run();
  return json({ok:true});
}
export async function backendSave(req:Request,env:Env){
  const b=await body(req),id=Number(b.id)||0;
  const values=[String(b.name||"").slice(0,80),String(b.base_url||"").trim(),String(b.api_key||""),String(b.model||"").trim(),Number(b.enabled??1),Number(b.priority)||100,Math.max(3000,Math.min(90000,Number(b.timeout_ms)||30000))];
  if(!values[0]||!values[1]||!values[3])return json({error:"名称、Base URL、模型必填"},400);
  if(id){
    if(values[2]) await env.DB.prepare("UPDATE ai_backends SET name=?,base_url=?,api_key=?,model=?,enabled=?,priority=?,timeout_ms=? WHERE id=?").bind(...values,id).run();
    else await env.DB.prepare("UPDATE ai_backends SET name=?,base_url=?,model=?,enabled=?,priority=?,timeout_ms=? WHERE id=?").bind(values[0],values[1],values[3],values[4],values[5],values[6],id).run();
  } else if(!values[2]) return json({error:"新增后端必须填写 API Key"},400);
  else await env.DB.prepare("INSERT INTO ai_backends(name,base_url,api_key,model,enabled,priority,timeout_ms) VALUES(?,?,?,?,?,?,?)").bind(...values).run();
  return json({ok:true});
}
export async function memoryRoutes(req:Request,env:Env,id:number){
  if(req.method==="GET"){const r=await env.DB.prepare("SELECT * FROM agent_memories WHERE agent_id=? ORDER BY importance DESC,updated_at DESC").bind(id).all();return json(r.results||[]);}
  const b=await body(req);
  if(req.method==="POST"){await env.DB.prepare("INSERT INTO agent_memories(agent_id,memory_type,content,importance,source) VALUES(?,?,?,?, 'manual')").bind(id,String(b.memory_type||"fact"),String(b.content||""),Math.max(1,Math.min(5,Number(b.importance)||3))).run();return json({ok:true});}
  if(req.method==="DELETE"){await env.DB.prepare("DELETE FROM agent_memories WHERE id=? AND agent_id=?").bind(Number(b.memoryId),id).run();return json({ok:true});}
  return json({error:"method"},405);
}
