import type { Env, Agent } from "./types";
import { json, now } from "./types";
import { askAI } from "./ai";

const rand=()=>Math.random();
async function dailyCount(env:Env,agentId:number){const r=await env.DB.prepare("SELECT COUNT(*) n FROM api_usage_logs WHERE agent_id=? AND created_at>=?").bind(agentId,now()-86400).first<any>();return Number(r?.n)||0;}
async function processMomentEvent(env:Env,agent:Agent,event:any,payload:any){
  if(!agent.enabled) return;
  // 用户刚发布朋友圈时立即触发：不受常规互动冷却和随机抽样影响，
  // 每个启用的智能体都会获得一次独立判断机会；仍受每日 API 上限保护。
  const immediateUserPost=event==="user_moment";
  if(!immediateUserPost && now()-agent.last_action_at < agent.min_action_interval_minutes*60) return;
  if(!immediateUserPost && rand()>Math.max(0,Math.min(1,agent.interaction_probability))) return;
  const moment=await env.DB.prepare("SELECT * FROM moments WHERE id=?").bind(payload.momentId).first<any>();
  if(!moment)return;
  const marker=await env.DB.prepare("SELECT id FROM agent_memories WHERE agent_id=? AND source=? LIMIT 1").bind(agent.id,`moment-response:${moment.id}`).first<any>();
  if(marker)return;
  const momentMemory=`朋友圈事件#${moment.id}｜${moment.author_type==='user'?'我':`智能体${moment.author_id}`}：${String(moment.content).slice(0,260)}`;
  await env.DB.prepare(`INSERT INTO agent_memories(agent_id,memory_type,content,importance,source)
    SELECT ?, 'moment', ?, 2, ? WHERE NOT EXISTS(SELECT 1 FROM agent_memories WHERE agent_id=? AND source=?)`)
    .bind(agent.id,momentMemory,`moment:${moment.id}`,agent.id,`moment:${moment.id}`).run();
  // 即使该 AI 暂时关闭自动互动，也会把公开朋友圈存入自己的记忆。
  if(!agent.auto_interact_enabled || (event==="user_like" && !agent.respond_to_user_like)) return;
  if(await dailyCount(env,agent.id)>=agent.daily_api_limit) return;
  const comments=await env.DB.prepare("SELECT actor_type,content FROM comments WHERE moment_id=? ORDER BY id DESC LIMIT 8").bind(payload.momentId).all<any>();
  const task=`你是独立的朋友圈用户。请基于你自己的性格、长期记忆和朋友圈关系，判断是否互动。只返回 JSON：{"like":true/false,"comment":"评论内容或空字符串"}。可以只点赞、只评论、两者都有或都不做。评论自然简短，不要复述原文，不要每次都套用相同语气。`;
  const result=await askAI(env,agent,"moment_interaction",task,`朋友圈：${moment.content}\n事件：${event}\n近期评论：${(comments.results||[]).map(x=>x.content).join("；")}`);
  let data:any={};try{data=JSON.parse(result.text.replace(/```json|```/g,"").trim());}catch{throw new Error(`智能体 ${agent.id} 对朋友圈 ${moment.id} 的 JSON 决策无法解析`);}
  if(data.like) await env.DB.prepare("INSERT OR IGNORE INTO likes(moment_id,actor_type,actor_id) VALUES(?,'agent',?)").bind(payload.momentId,agent.id).run();
  if(typeof data.comment==="string"&&data.comment.trim()) await env.DB.prepare("INSERT INTO comments(moment_id,actor_type,actor_id,content) VALUES(?,'agent',?,?)").bind(payload.momentId,agent.id,data.comment.slice(0,500)).run();
  await env.DB.prepare("INSERT INTO agent_memories(agent_id,memory_type,content,importance,source) VALUES(?,'system',?,1,?)")
    .bind(agent.id,`已完成朋友圈#${moment.id}的互动判断`,`moment-response:${moment.id}`).run();
  await env.DB.prepare("UPDATE agents SET last_action_at=? WHERE id=?").bind(now(),agent.id).run();
}
async function maybePost(env:Env,agent:Agent){
  if(!agent.enabled||!agent.auto_post_enabled||!env.DB)return;
  if(now()-agent.last_post_time < 6*3600)return;
  const count=await env.DB.prepare("SELECT COUNT(*) n FROM moments WHERE author_type='agent' AND author_id=? AND created_at>=?").bind(agent.id,now()-86400).first<any>();
  if(Number(count?.n||0)>=agent.daily_post_limit)return;
  if(await dailyCount(env,agent.id)>=agent.daily_api_limit)return;
  // 低活跃度下先进行本地概率筛选，不调用模型。
  const probability=agent.activity_level==="low"?0.04:agent.activity_level==="high"?0.18:0.08;
  if(rand()>probability)return;
  const memory=await env.DB.prepare("SELECT content FROM agent_memories WHERE agent_id=? ORDER BY importance DESC LIMIT 5").bind(agent.id).all<any>();
  const result=await askAI(env,agent,"scheduled_moment","根据你的人设和记忆，判断现在是否有自然的朋友圈内容值得发布。没有就只输出 NONE；有则只输出朋友圈正文，最多 120 字。",(memory.results||[]).map(x=>x.content).join("\n"));
  if(result.text.trim().toUpperCase()!=="NONE"&&result.text.length<1000){
    await env.DB.prepare("INSERT INTO moments(author_type,author_id,content) VALUES('agent',?,?)").bind(agent.id,result.text).run();
    await env.DB.prepare("UPDATE agents SET last_post_time=?,last_action_at=? WHERE id=?").bind(now(),now(),agent.id).run();
  }
}
export async function processUserMomentImmediately(env:Env,momentId:number){
  const agents=(await env.DB.prepare("SELECT * FROM agents WHERE enabled=1 ORDER BY id").all<Agent>()).results||[];
  const results=await Promise.allSettled(agents.map(agent=>processMomentEvent(env,agent,"user_moment",{momentId})));
  for(const r of results) if(r.status==="rejected") await env.DB.prepare("INSERT INTO system_logs(level,message) VALUES('error',?)").bind(String(r.reason).slice(0,500)).run();
  return {agents:agents.length,failed:results.filter(r=>r.status==="rejected").length};
}

export async function runProbe(env:Env){
  if(!env.DB)return {ok:true,skipped:"D1 binding not configured"};
  const s=await env.DB.prepare("SELECT * FROM settings WHERE id=1").first<any>();
  if(!s||!s.probe_enabled)return {ok:true,skipped:"disabled"};
  const agents=(await env.DB.prepare("SELECT * FROM agents WHERE enabled=1").all<Agent>()).results||[];
  const tasks=(await env.DB.prepare("SELECT * FROM probe_tasks WHERE status='pending' ORDER BY id LIMIT 30").all<any>()).results||[];
  for(const task of tasks){
    await env.DB.prepare("UPDATE probe_tasks SET status='processing',attempts=attempts+1 WHERE id=? AND status='pending'").bind(task.id).run();
    try{
      const payload=JSON.parse(task.payload_json||"{}");
      for(const agent of agents) await processMomentEvent(env,agent,task.event_type,payload);
      await env.DB.prepare("UPDATE probe_tasks SET status='done',processed_at=? WHERE id=?").bind(now(),task.id).run();
    }catch(e){
      await env.DB.prepare("UPDATE probe_tasks SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END WHERE id=?").bind(task.id).run();
      await env.DB.prepare("INSERT INTO system_logs(level,message) VALUES('error',?)").bind(String(e).slice(0,500)).run();
    }
  }
  // 即使没有事件，也仅以本地概率决定是否为某个 AI 生成朋友圈。
  for(const agent of agents){try{await maybePost(env,agent);}catch(e){await env.DB.prepare("INSERT INTO system_logs(level,message) VALUES('error',?)").bind(String(e).slice(0,500)).run();}}
  return {ok:true,tasks:tasks.length,agents:agents.length};
}
export async function probeHttp(req:Request,env:Env){
  if(!env.DB)return json({error:"D1 binding not configured"},503);
  const supplied=new URL(req.url).searchParams.get("secret")||req.headers.get("x-probe-secret")||"";
  if(!env.PROBE_SECRET||supplied!==env.PROBE_SECRET)return json({error:"unauthorized"},401);
  return json(await runProbe(env));
}
