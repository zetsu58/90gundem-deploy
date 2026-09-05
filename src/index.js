const QUERIES = [
  "Türkiye son dakika", "Türkiye gündem", "siyaset son dakika",
  "ekonomi son dakika", "gündelik yaşam son dakika", "dünya son dakika",
  "teknoloji son dakika", "sağlık son dakika"
];
const X_POST_URL = "https://api.x.com/2/tweets";

function rssUrl(q) { return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=tr&gl=TR&ceid=TR:tr`; }
function decodeXml(s="") { return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">"); }
function items(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,8).map(m => {
    const x=m[1]; const get=t => decodeXml((x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`))||[])[1]||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    return {title:get("title"),link:get("link"),pubDate:get("pubDate"),source:get("source")};
  });
}
async function fingerprint(text) {
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü ]/gi," ").replace(/\s+/g," ").trim()));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function pct(s){return encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);}
function b64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
async function hmacSha1(key,data){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-1"},false,["sign"]);return b64(new Uint8Array(await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(data))));}
async function oauthHeader(env, method, url) {
  for (const k of ["X_API_KEY","X_API_SECRET","X_ACCESS_TOKEN","X_ACCESS_TOKEN_SECRET"]) if(!env[k]) throw new Error(`missing_${k}`);
  const p={oauth_consumer_key:env.X_API_KEY,oauth_nonce:crypto.randomUUID().replaceAll("-",""),oauth_signature_method:"HMAC-SHA1",oauth_timestamp:String(Math.floor(Date.now()/1000)),oauth_token:env.X_ACCESS_TOKEN,oauth_version:"1.0"};
  const param=Object.entries(p).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${pct(k)}=${pct(v)}`).join("&");
  const base=[method.toUpperCase(),pct(url),pct(param)].join("&");
  p.oauth_signature=await hmacSha1(`${pct(env.X_API_SECRET)}&${pct(env.X_ACCESS_TOKEN_SECRET)}`,base);
  return "OAuth "+Object.entries(p).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${pct(k)}=\"${pct(v)}\"`).join(", ");
}
function postText(n){
  let title=n.title.replace(/\s+-\s+[^-]{2,60}$/," ").trim();
  const source=n.source ? `\n\nKaynak: ${n.source}` : "";
  const suffix="\n\n#SonDakika #Gündem";
  const room=280-source.length-suffix.length;
  if(title.length>room) title=title.slice(0,Math.max(0,room-1)).trimEnd()+"…";
  return title+source+suffix;
}
async function countToday(env){const r=await env.DB.prepare("SELECT COUNT(*) n FROM published_news WHERE published_at >= datetime('now','start of day')").first();return Number(r?.n||0);}
async function publishX(env,n){
  const auth=await oauthHeader(env,"POST",X_POST_URL);
  const r=await fetch(X_POST_URL,{method:"POST",headers:{Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify({text:postText(n)})});
  const body=await r.json().catch(()=>({}));
  if(!r.ok || !body?.data?.id) throw new Error(`x_http_${r.status}:${JSON.stringify(body).slice(0,300)}`);
  return body.data.id;
}
async function scan(env) {
  const maxAge=Number(env.X_MAX_AGE_MINUTES||3)*60000, now=Date.now();
  const feeds=await Promise.all(QUERIES.map(async q=>{try{const r=await fetch(rssUrl(q),{headers:{"User-Agent":"90Gundem/1.0"}});return r.ok?items(await r.text()):[];}catch{return[];}}));
  const fresh=feeds.flat().filter(x=>x.title&&x.pubDate&&now-new Date(x.pubDate).getTime()>=0&&now-new Date(x.pubDate).getTime()<=maxAge);
  const unique=[],seen=new Set(); for(const n of fresh){const fp=await fingerprint(n.title);if(!seen.has(fp)){seen.add(fp);unique.push({...n,fp});}}
  const enabled=String(env.X_PUBLISH_ENABLED).toLowerCase()==="true", limit=Math.max(0,Number(env.X_DAILY_POST_LIMIT||1));
  let used=await countToday(env),candidates=0,published=0,lastError=null;
  for(const n of unique){
    if(await env.DB.prepare("SELECT 1 FROM published_news WHERE fingerprint=? LIMIT 1").bind(n.fp).first())continue;
    candidates++;
    if(!enabled||used>=limit)continue;
    try{const id=await publishX(env,n);await env.DB.prepare("INSERT INTO published_news(fingerprint,title,source_url,x_post_id) VALUES(?,?,?,?)").bind(n.fp,n.title,n.link,id).run();used++;published++;break;}
    catch(e){lastError=String(e?.message||e);break;}
  }
  const state={at:new Date().toISOString(),fresh:fresh.length,candidates,published,used,limit,publishing:enabled,lastError};
  await env.DB.prepare("INSERT INTO worker_state(key,value,updated_at) VALUES('last_scan',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(state)).run();
  return {ok:true,...state};
}

export default {
  async fetch(request,env){
    const u=new URL(request.url);
    if(u.pathname==="/health")return Response.json({status:"ok",service:"90gundem-cloudflare",publishing:String(env.X_PUBLISH_ENABLED).toLowerCase()==="true",credentials_ready:["X_API_KEY","X_API_SECRET","X_ACCESS_TOKEN","X_ACCESS_TOKEN_SECRET"].every(k=>Boolean(env[k]))});
    if(u.pathname==="/status"){const s=await env.DB.prepare("SELECT value,updated_at FROM worker_state WHERE key='last_scan'").first();return Response.json({status:"ok",last_scan:s||null});}
    return new Response("90+ GUNDEM Cloudflare Worker",{status:200});
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(scan(env));}
};
