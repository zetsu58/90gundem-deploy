const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
function auth(req,env){const s=env.X_PUBLISHER_TOKEN;return Boolean(s)&&(req.headers.get('authorization')||'')===`Bearer ${s}`}
export async function xApiPublisher(req,env){
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 if(!auth(req,env))return json({error:'unauthorized'},401);
 if(env.X_PUBLISH_ENABLED!=='true')return json({error:'x_publish_disabled'},403);
 if(!env.X_USER_ACCESS_TOKEN)return json({error:'x_user_access_token_missing'},503);
 const b=await req.json();const text=String(b.text||'').trim();if(!text||text.length>280)return json({error:'invalid_text'},400);
 // X API v2 create Post. User-context access token must have write permission.
 const r=await fetch('https://api.x.com/2/tweets',{method:'POST',headers:{'authorization':`Bearer ${env.X_USER_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({text})});
 const raw=await r.text();let d={};try{d=JSON.parse(raw)}catch{d={raw:raw.slice(0,300)}}
 if(!r.ok)return json({error:'x_api_error',http_status:r.status,details:d},502);
 const id=d?.data?.id;if(!id)return json({error:'x_api_missing_id',details:d},502);
 return json({id:String(id),text:d?.data?.text||text});
}
