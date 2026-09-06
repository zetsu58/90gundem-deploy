import live from './index-v20.js';
import { fetchPusholder } from './pusholder.js';
import { enrichNews } from './openrouter.js';
import { growthDecision, growthXText, recordGrowthEvent } from './growth-v21.js';
import { enqueueForAI, newsroomFetch } from './ai-newsroom-bridge.js';

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü ]/gi,' ').replace(/\s+/g,' ').trim();
const words=s=>new Set(norm(s).split(' ').filter(x=>x.length>3));
function similar(a,b){const A=words(a),B=words(b);let n=0;for(const x of A)if(B.has(x))n++;return A.size&&B.size&&n>=3&&n/Math.min(A.size,B.size)>=.38}
async function hash(s){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(norm(s)));return[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,48)}
async function state(env,key){return(await env.DB.prepare('SELECT value FROM worker_state WHERE key=?').bind(key).first())?.value||null}
async function setState(env,key,value){await env.DB.prepare('INSERT INTO worker_state(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').bind(key,String(value)).run()}

async function notify(env,i,decision){
 const chat=env.TELEGRAM_CHAT_ID||await state(env,'telegram_chat_id');
 if(!chat||!env.TELEGRAM_BOT_TOKEN) throw new Error('telegram_not_configured');
 const x=growthXText(i), imageOk=Boolean(i.image);
 const prefix=`📈 V21 PUAN: ${decision.score}/100${imageOk?' · 🖼️':' · ⚠️ Görsel yok'}\n\n`;
 const f=new FormData();f.append('chat_id',String(chat));f.append('caption',(prefix+x).slice(0,1000));
 f.append('reply_markup',JSON.stringify({inline_keyboard:[[{text:'𝕏 X’TE PAYLAŞ',url:`https://twitter.com/intent/tweet?text=${encodeURIComponent(x)}`}]]}));
 let endpoint='sendMessage';
 if(imageOk){try{const r=await fetch(i.image,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){f.append('photo',new Blob([new Uint8Array(await r.arrayBuffer())],{type:r.headers.get('content-type')||'image/jpeg'}),'90gundem.jpg');endpoint='sendPhoto'}}catch{}}
 if(endpoint==='sendMessage')f.append('text',(prefix+x).slice(0,4000));
 const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${endpoint}`,{method:'POST',body:f});const j=await r.json();if(!j.ok)throw new Error('telegram:'+j.description);
}

async function growthRun(env,manual=false){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS worker_state(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS speed_queue(fingerprint TEXT PRIMARY KEY,title TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
 const started=new Date().toISOString();await setState(env,'growth_heartbeat',started);const items=await fetchPusholder();
 const cursor=Number(await state(env,'growth_last_id')||0),latest=items.reduce((m,x)=>Math.max(m,Number(x.pusholder_id)||0),0);
 if(!cursor){if(latest)await setState(env,'growth_last_id',latest);return {status:'ok',version:'growth-v22-bridge',mode:'cursor_initialized',last_id:latest}}
 const pending=items.filter(i=>Number(i.pusholder_id)>cursor).sort((a,b)=>Number(a.pusholder_id)-Number(b.pusholder_id)).slice(0,5);
 const rows=await env.DB.prepare("SELECT title FROM speed_queue WHERE created_at >= datetime('now','-120 minutes') ORDER BY created_at DESC LIMIT 100").all();
 const recent=(rows.results||[]).map(x=>x.title);let queued=0,notified=0,skipped=0,failed=0,last=cursor,errors=[];
 for(const p of pending){const id=Number(p.pusholder_id);try{
  if(recent.some(t=>similar(t,p.title))){skipped++;last=Math.max(last,id);continue}
  let i=p;if(env.OPENROUTER_API_KEY)i={...p,...await enrichNews(env,{primary:p,items:[p]}),image:p.image,link:p.link,pusholder_id:p.pusholder_id};
  const fp=await hash(i.title),decision=growthDecision(i,env);await recordGrowthEvent(env,i,decision,fp);
  if(decision.action==='skip'){skipped++;last=Math.max(last,id);continue}
  if(env.AI_NEWSROOM_ENABLED==='true'){
    await enqueueForAI(env,i,decision,fp);queued++;
  }else{
    await notify(env,i,decision);notified++;
  }
  recent.push(i.title);await env.DB.prepare("INSERT OR IGNORE INTO speed_queue(fingerprint,title,status) VALUES(?,?,?)").bind(fp,i.title,env.AI_NEWSROOM_ENABLED==='true'?'ai_queued':'growth_ready').run();last=Math.max(last,id);
 }catch(e){failed++;errors.push(String(e?.message||e).slice(0,160));break}}
 if(last>cursor)await setState(env,'growth_last_id',last);
 const out={status:failed?'partial':'ok',version:'growth-v22-bridge',manual,at:started,scanned:items.length,new_items:pending.length,queued,notified,skipped,failed,cursor_before:cursor,cursor_after:last,errors};
 await setState(env,'growth_status',JSON.stringify(out));return out;
}

export default {
 async fetch(req,env,ctx){const u=new URL(req.url);
  if(u.pathname.startsWith('/ai-newsroom/')){const r=await newsroomFetch(req,env);if(r)return r}
  if(u.pathname==='/growth-test')return Response.json(await growthRun(env,true));
  if(u.pathname==='/growth-status'){const raw=await state(env,'growth_status');return Response.json({status:raw?'ok':'waiting',version:'growth-v22-bridge',heartbeat:await state(env,'growth_heartbeat'),last_id:await state(env,'growth_last_id'),last_run:raw?JSON.parse(raw):null})}
  if(u.pathname==='/health'){const r=await live.fetch(req,env,ctx);let d={};try{d=await r.clone().json()}catch{}return Response.json({...d,growth_version:'v22-bridge',growth_engine:true,ai_newsroom:env.AI_NEWSROOM_ENABLED==='true',growth_min_score:Number(env.GROWTH_MIN_SCORE||50)})}
  return live.fetch(req,env,ctx)
 },
 async scheduled(event,env,ctx){ctx.waitUntil(growthRun(env,false))}
};
