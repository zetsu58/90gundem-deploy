const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
async function state(env,key){return(await env.DB.prepare('SELECT value FROM worker_state WHERE key=?').bind(key).first())?.value||null}

export async function sendEditorCard(env,row,result){
 const chat=env.TELEGRAM_CHAT_ID||await state(env,'telegram_chat_id');
 if(!chat||!env.TELEGRAM_BOT_TOKEN)throw new Error('telegram_not_configured');
 const v=Number(result.verification_score||0),viral=Number(result.viral_score||0),img=Number(result.image_check?.image_relevance_score||0);
 const decision=String(result.publish_decision||'review').toUpperCase();
 const text=`🧠 +90Gündem V22 Editör\n\n${clean(result.title||row.title)}\n\n${clean(result.summary||row.description||'')}\n\n🛡️ Doğrulama: ${v}/100\n🔥 Viral: ${viral}/100\n🖼️ Görsel: ${img}/100\n📚 Bağımsız kaynak: ${Number(result.independent_source_count||0)}\n🤖 AI kararı: ${decision}\n\n${clean(result.x_text||'')}`.slice(0,3900);
 const keyboard={inline_keyboard:[
  [{text:'✅ Yayın adayı',callback_data:`v22:approve:${row.id}`},{text:'✏️ İncele',callback_data:`v22:review:${row.id}`}],
  [{text:'❌ Reddet',callback_data:`v22:reject:${row.id}`}]
 ]};
 const payload={chat_id:String(chat),text,reply_markup:keyboard,disable_web_page_preview:true};
 const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const j=await r.json();if(!j.ok)throw new Error('telegram:'+j.description);return j.result;
}

export async function handleTelegramEditor(req,env){
 if(req.method!=='POST')return new Response('method_not_allowed',{status:405});
 const secret=env.TELEGRAM_WEBHOOK_SECRET;
 if(secret&&req.headers.get('x-telegram-bot-api-secret-token')!==secret)return new Response('unauthorized',{status:401});
 const update=await req.json(),q=update.callback_query;if(!q)return Response.json({ok:true});
 const m=/^v22:(approve|review|reject):(\d+)$/.exec(q.data||'');if(!m)return Response.json({ok:true});
 const action=m[1],id=Number(m[2]);
 const status=action==='approve'?'approved':action==='reject'?'rejected':'editor_review';
 await env.DB.prepare("UPDATE ai_newsroom_queue SET status=? WHERE id=?").bind(status,id).run();
 await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({callback_query_id:q.id,text:action==='approve'?'Yayın adayı onaylandı':action==='reject'?'Haber reddedildi':'İncelemeye alındı'})});
 return Response.json({ok:true,id,status});
}
