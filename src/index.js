const QUERIES = [
  "Türkiye son dakika", "Türkiye gündem", "siyaset son dakika",
  "ekonomi son dakika", "gündelik yaşam son dakika", "dünya son dakika",
  "teknoloji son dakika", "sağlık son dakika"
];

function rssUrl(q) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=tr&gl=TR&ceid=TR:tr`;
}
function decodeXml(s="") {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function items(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const x=m[1]; const get=t => decodeXml((x.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`))||[])[1]||"").trim();
    return { title:get("title"), link:get("link"), pubDate:get("pubDate"), source:get("source") };
  });
}
async function fingerprint(text) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü ]/gi," ").replace(/\s+/g," ").trim()));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function scan(env) {
  const maxAge = Number(env.X_MAX_AGE_MINUTES || 3) * 60000;
  const now = Date.now();
  const feeds = await Promise.all(QUERIES.map(async q => {
    try { const r=await fetch(rssUrl(q), {headers:{"User-Agent":"90Gundem/1.0"}}); return r.ok ? items(await r.text()) : []; }
    catch { return []; }
  }));
  const fresh = feeds.flat().filter(x => x.title && x.pubDate && now-new Date(x.pubDate).getTime() <= maxAge);
  const unique=[]; const seen=new Set();
  for (const n of fresh) { const fp=await fingerprint(n.title); if(!seen.has(fp)){seen.add(fp); unique.push({...n,fp});} }
  let candidates=0;
  for (const n of unique) {
    const old=await env.DB.prepare("SELECT 1 FROM published_news WHERE fingerprint=? LIMIT 1").bind(n.fp).first();
    if(old) continue;
    candidates++;
    // Live X transport intentionally stays gated until credentials, OAuth signing and spend controls are verified.
    if (String(env.X_PUBLISH_ENABLED).toLowerCase() !== "true") continue;
  }
  await env.DB.prepare("INSERT INTO worker_state(key,value,updated_at) VALUES('last_scan',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify({at:new Date().toISOString(),fresh:fresh.length,candidates})).run();
  return {ok:true,fresh:fresh.length,candidates,publishing:String(env.X_PUBLISH_ENABLED).toLowerCase()==="true"};
}

export default {
  async fetch(request, env) {
    const u=new URL(request.url);
    if(u.pathname==="/health") return Response.json({status:"ok",service:"90gundem-cloudflare",publishing:String(env.X_PUBLISH_ENABLED).toLowerCase()==="true"});
    if(u.pathname==="/status") {
      const s=await env.DB.prepare("SELECT value,updated_at FROM worker_state WHERE key='last_scan'").first();
      return Response.json({status:"ok",last_scan:s||null});
    }
    return new Response("90+ GUNDEM Cloudflare Worker", {status:200});
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(scan(env));
  }
};
