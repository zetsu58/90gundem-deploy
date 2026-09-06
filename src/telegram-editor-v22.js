const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
async function state(env,key){return(await env.DB.prepare('SELECT value FROM worker_state WHERE key=?').bind(key).first())?.value||null}
const composeUrl=text=>`https://twitter.com/intent/tweet?text=${encodeURIComponent(clean(text).slice(0,280))}`;
const tg=(env,method,payload)=>fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
async function answer(env,id,text){if(!id)return;try{await tg(env,'answerCallbackQuery',{callback_query_id:id,text})}catch{}}
async function markup(env,q,buttons){const chat=q?.message?.chat?.id,message_id=q?.message?.message_id;if(chat==null||message_id==null)return;try{await tg(env,'editMessageReplyMarkup',{chat_id:String(chat),message_id,reply_markup:{inline_keyboard:buttons}})}catch{}}

export async function sendEditorCard(env,row,result){
 const chat=env.TELEGRAM_CHAT_ID||await state(env,'telegram_chat_id');if(!chat||!env.TELEGRAM_BOT_TOKEN)throw new Error('telegram_not_configured');
 const v=Number(result.verification_score||0),viral=Number(result.viral_score||0),img=Number(result.image_check?.image_relevance_score||0),decision=String(result.publish_decision||'review').toUpperCase();
 const x=clean(result.x_text||row.title).slice(0,280);
 const text=`🧠 +90Gündem V22 Editör\n\n${clean(result.title||row.title)}\n\n${clean(result.summary||row.description||'')}\n\n🛡️ Doğrulama: ${v}/100\n🔥 Viral: ${viral}/100\n🖼️ Görsel: ${img}/100\n📚 Bağımsız kaynak: ${Number(result.independent_source_count||0)}\n🤖 AI kararı: ${decision}\n\n📝 X metni:\n${x}`.slice(0,3900);
 const buttons=[];if(decision==='PUBLISH')buttons.push([{text:'𝕏 ÜCRETSİZ X’TE AÇ',url:composeUrl(x)}]);
 buttons.push([{text:'✅ Hazır',callback_data:`v22:approve:${row.id}`},{text:'✏️ İncele',callback_data:`v22:review:${row.id}`}],[{text:'❌ Reddet',callback_data:`v22:reject:${row.id}`}]);
 const r=await tg(env,'sendMessage',{chat_id:String(chat),text,reply_markup:{inline_keyboard:buttons},disable_web_page_preview:true});const j=await r.json();if(!j.ok)throw new Error('telegram:'+j.description);return j.result;
}

export async function handleTelegramEditor(req,env){
 if(req.method!=='POST')return new Response('method_not_allowed',{status:405});
 const secret=env.TELEGRAM_WEBHOOK_SECRET;if(!secret)return Response.json({error:'webhook_secret_not_configured'},{status:503});
 if(req.headers.get('x-telegram-bot-api-secret-token')!==secret)return Response.json({error:'unauthorized'},{status:401});
 if(!env.TELEGRAM_BOT_TOKEN)return Response.json({error:'telegram_not_configured'},{status:503});
 let update;try{update=await req.json()}catch{return Response.json({error:'invalid_json'},{status:400})}
 const q=update.callback_query;if(!q)return Response.json({ok:true});const m=/^v22:(approve|review|reject):(\d+)$/.exec(q.data||'');if(!m)return Response.json({ok:true});
 const action=m[1],id=Number(m[2]);const row=await env.DB.prepare('SELECT id,title,ai_result,status FROM ai_newsroom_queue WHERE id=?').bind(id).first();
 if(!row){await answer(env,q.id,'Haber bulunamadı');return Response.json({ok:false,error:'not_found'},{status:404})}
 if(row.status!=='editor_pending'){await answer(env,q.id,'Bu haber daha önce işlendi');return Response.json({ok:true,id,status:row.status,already_handled:true,x_api:false})}
 const status=action==='approve'?'share_ready':action==='reject'?'rejected':'editor_review';const changed=await env.DB.prepare("UPDATE ai_newsroom_queue SET status=? WHERE id=? AND status='editor_pending'").bind(status,id).run();
 if(!changed.meta?.changes){await answer(env,q.id,'Bu haber daha önce işlendi');return Response.json({ok:true,id,already_handled:true,x_api:false})}
 let result={};try{result=JSON.parse(row.ai_result||'{}')}catch{}const x=clean(result.x_text||row.title).slice(0,280);
 if(action==='approve')await markup(env,q,[[{text:'𝕏 ÜCRETSİZ X’TE AÇ',url:composeUrl(x)}]]);else await markup(env,q,[]);
 await answer(env,q.id,action==='approve'?'Ücretsiz X paylaşımına hazır':action==='reject'?'Haber reddedildi':'İncelemeye alındı');
 return Response.json({ok:true,id,status,x_api:false});
}
