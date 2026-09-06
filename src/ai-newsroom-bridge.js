const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();

async function ensure(env){
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_newsroom_queue(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT UNIQUE NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  image TEXT,
  growth_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_result TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TEXT,
  completed_at TEXT
 )`).run();
}

function authorized(req,env){
 const secret=env.AI_NEWSROOM_TOKEN;
 if(!secret)return false;
 const h=req.headers.get('authorization')||'';
 return h===`Bearer ${secret}`;
}

export async function enqueueForAI(env,i,decision,fp){
 await ensure(env);
 await env.DB.prepare(`INSERT OR IGNORE INTO ai_newsroom_queue
 (fingerprint,source_id,title,description,link,image,growth_score,status)
 VALUES(?,?,?,?,?,?,?,'pending')`).bind(fp,String(i.pusholder_id||''),clean(i.title),clean(i.description),i.link||'',i.image||'',Number(decision.score||0)).run();
}

export async function newsroomFetch(req,env){
 if(!authorized(req,env))return json({status:'error',error:'unauthorized'},401);
 await ensure(env);
 const u=new URL(req.url);
 if(req.method==='GET'&&u.pathname==='/ai-newsroom/pull'){
  const limit=Math.min(20,Math.max(1,Number(u.searchParams.get('limit')||5)));
  const r=await env.DB.prepare("SELECT * FROM ai_newsroom_queue WHERE status='pending' ORDER BY growth_score DESC, id ASC LIMIT ?").bind(limit).all();
  return json({status:'ok',items:r.results||[]});
 }
 if(req.method==='POST'&&u.pathname==='/ai-newsroom/claim'){
  const b=await req.json();
  await env.DB.prepare("UPDATE ai_newsroom_queue SET status='processing',claimed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(Number(b.id)).run();
  return json({status:'ok'});
 }
 if(req.method==='POST'&&u.pathname==='/ai-newsroom/result'){
  const b=await req.json();
  if(!b.id||!b.result)return json({status:'error',error:'id_and_result_required'},400);
  const decision=String(b.result.publish_decision||'review');
  const status=['publish','review','reject'].includes(decision)?decision:'review';
  await env.DB.prepare("UPDATE ai_newsroom_queue SET status=?,ai_result=?,completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,JSON.stringify(b.result),Number(b.id)).run();
  return json({status:'ok',id:Number(b.id),decision:status});
 }
 if(req.method==='GET'&&u.pathname==='/ai-newsroom/status'){
  const r=await env.DB.prepare("SELECT status,COUNT(*) count FROM ai_newsroom_queue GROUP BY status").all();
  return json({status:'ok',queue:r.results||[]});
 }
 return null;
}
