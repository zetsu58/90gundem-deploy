import { sendEditorCard } from './telegram-editor-v22.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
async function ensure(env){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_newsroom_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,fingerprint TEXT UNIQUE NOT NULL,source_id TEXT,title TEXT NOT NULL,description TEXT,link TEXT,image TEXT,growth_score INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'pending',ai_result TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,claimed_at TEXT,completed_at TEXT)`).run()}
function authorized(req,env){const secret=env.AI_NEWSROOM_TOKEN;if(!secret)return false;return(req.headers.get('authorization')||'')===`Bearer ${secret}`}
export async function enqueueForAI(env,i,decision,fp){await ensure(env);await env.DB.prepare(`INSERT OR IGNORE INTO ai_newsroom_queue(fingerprint,source_id,title,description,link,image,growth_score,status) VALUES(?,?,?,?,?,?,?,'pending')`).bind(fp,String(i.pusholder_id||''),clean(i.title),clean(i.description),i.link||'',i.image||'',Number(decision.score||0)).run()}
export async function newsroomFetch(req,env){
 if(!authorized(req,env))return json({status:'error',error:'unauthorized'},401);await ensure(env);const u=new URL(req.url);
 if(req.method==='GET'&&u.pathname==='/ai-newsroom/pull'){const limit=Math.min(20,Math.max(1,Number(u.searchParams.get('limit')||5)));const r=await env.DB.prepare("SELECT * FROM ai_newsroom_queue WHERE status='pending' ORDER BY growth_score DESC,id ASC LIMIT ?").bind(limit).all();return json({status:'ok',items:r.results||[]})}
 if(req.method==='GET'&&u.pathname==='/ai-newsroom/context'){const hours=Math.min(48,Math.max(1,Number(u.searchParams.get('hours')||12))),limit=Math.min(200,Math.max(10,Number(u.searchParams.get('limit')||100)));const r=await env.DB.prepare("SELECT id,source_id,title,description,link,image,growth_score,status,created_at FROM ai_newsroom_queue WHERE created_at>=datetime('now',?) ORDER BY id DESC LIMIT ?").bind(`-${hours} hours`,limit).all();return json({status:'ok',hours,items:r.results||[]})}
 if(req.method==='POST'&&u.pathname==='/ai-newsroom/claim'){const b=await req.json();const r=await env.DB.prepare("UPDATE ai_newsroom_queue SET status='processing',claimed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(Number(b.id)).run();if(!r.meta?.changes)return json({status:'error',error:'not_pending',claimed:false},409);return json({status:'ok',claimed:true})}
 if(req.method==='POST'&&u.pathname==='/ai-newsroom/result'){
  const b=await req.json();if(!b.id||!b.result)return json({status:'error',error:'id_and_result_required'},400);const decision=String(b.result.publish_decision||'review');const status=['publish','review','reject'].includes(decision)?decision:'review';
  const changed=await env.DB.prepare("UPDATE ai_newsroom_queue SET status=?,ai_result=?,completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='processing'").bind(status,JSON.stringify(b.result),Number(b.id)).run();if(!changed.meta?.changes)return json({status:'error',error:'not_processing'},409);
  const row=await env.DB.prepare('SELECT * FROM ai_newsroom_queue WHERE id=?').bind(Number(b.id)).first();let editor_sent=false,editor_error=null;
  if(row&&env.V22_EDITOR_TELEGRAM_ENABLED==='true'&&status!=='reject')try{await sendEditorCard(env,row,b.result);editor_sent=true;await env.DB.prepare("UPDATE ai_newsroom_queue SET status='editor_pending' WHERE id=? AND status=?").bind(Number(b.id),status).run()}catch(e){editor_error=String(e?.message||e).slice(0,180)}
  return json({status:'ok',id:Number(b.id),decision,editor_sent,editor_error});
 }
 if(req.method==='GET'&&u.pathname==='/ai-newsroom/status'){const r=await env.DB.prepare("SELECT status,COUNT(*) count FROM ai_newsroom_queue GROUP BY status").all();return json({status:'ok',queue:r.results||[]})}
 return null;
}
