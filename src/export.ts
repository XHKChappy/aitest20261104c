import type { Env } from "./types";
import { json } from "./types";
const TABLES=["users","settings","agents","agent_memories","agent_profiles","chat_records","moments","likes","comments","agent_interaction_rules","probe_tasks"];
export async function exportData(env:Env){
  const data:any={format:"ai-wechat-moments",version:1,exportedAt:new Date().toISOString(),tables:{}};
  for(const table of TABLES){
    const rows=await env.DB.prepare(`SELECT * FROM ${table}`).all<any>();
    data.tables[table]=rows.results||[];
  }
  // API 密钥绝不随普通备份导出。
  const backends=await env.DB.prepare("SELECT id,name,base_url,model,enabled,priority,timeout_ms FROM ai_backends").all<any>();
  data.tables.ai_backends=(backends.results||[]).map(x=>({...x,api_key:""}));
  return new Response(JSON.stringify(data,null,2),{headers:{
    "content-type":"application/json; charset=utf-8",
    "content-disposition":'attachment; filename="ai-wechat-backup.json"',
    "cache-control":"no-store"
  }});
}
export async function importData(req:Request,env:Env){
  const data=await req.json().catch(()=>null) as any;
  if(!data||data.format!=="ai-wechat-moments"||data.version!==1||!data.tables)return json({error:"备份文件格式或版本不正确"},400);
  const allowed=new Set([...TABLES,"ai_backends"]);
  for(const key of Object.keys(data.tables))if(!allowed.has(key)||!Array.isArray(data.tables[key]))return json({error:`非法数据表：${key}`},400);
  // 导入采用覆盖式事务；不导入 session、API Key、日志。导入前请先下载备份。
  const order=["comments","likes","chat_records","agent_memories","agent_profiles","agent_interaction_rules","moments","probe_tasks","agents","settings","users"];
  for(const t of order) await env.DB.prepare(`DELETE FROM ${t}`).run();
  for(const t of order){
    const rows=data.tables[t]||[];
    for(const row of rows){
      const cols=Object.keys(row).filter(k=>/^[a-z_]+$/i.test(k));
      if(!cols.length)continue;
      const sql=`INSERT INTO ${t}(${cols.join(",")}) VALUES(${cols.map(()=>"?").join(",")})`;
      await env.DB.prepare(sql).bind(...cols.map(c=>row[c])).run();
    }
  }
  return json({ok:true,warning:"API Key 和登录会话未导入，请重新配置 API 密钥并重新登录。"});
}
