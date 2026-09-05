// Pusholder fast lane: always request the channel's actual latest public preview.
const BASE='https://t.me/s/pusholder';
const dec=s=>String(s||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export async function fetchPusholder(){
  // IMPORTANT: do not use ?before=... here. Telegram interprets it as pagination
  // and it can pin the worker to an older page instead of the live channel tail.
  const url=`${BASE}?cb=${Date.now()}`;
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; 90Gundem/27.0)','Accept':'text/html,application/xhtml+xml','Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'},redirect:'follow',cf:{cacheTtl:0,cacheEverything:false}});
  if(!r.ok)throw new Error(`pusholder_http_${r.status}`);
  const h=await r.text();
  const blocks=h.split(/<div class="tgme_widget_message_wrap[^>]*>/i).slice(1,51),out=[];
  for(const b of blocks){
    const id=b.match(/data-post=["']pusholder\/(\d+)/i)?.[1];
    const tm=b.match(/<time[^>]+datetime=["']([^"']+)/i)?.[1];
    const text=b.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    if(!id||!tm||!text)continue;
    const body=dec(text),ts=Date.parse(tm);if(!body||!Number.isFinite(ts))continue;
    const im=b.match(/tgme_widget_message_photo_wrap[^>]+style=["'][^"']*background-image:url\(['"]?([^'"\)]+)/i)?.[1]||'';
    const first=(body.match(/[^.!?]+[.!?]?/)?.[0]||body).trim();
    out.push({source:'Pusholder Telegram',publisher:'Pusholder',trust:100,direct:true,title:first.slice(0,180),description:body,link:`https://t.me/pusholder/${id}`,pubDate:new Date(ts).toUTCString(),ts,image:im?decodeURIComponent(im):'',pusholder_id:id});
  }
  if(!out.length)throw new Error(`pusholder_parse_empty_${h.length}`);
  const unique=[...new Map(out.map(x=>[x.pusholder_id,x])).values()].sort((a,b)=>Number(b.pusholder_id)-Number(a.pusholder_id));
  return unique;
}
export const PUSHOLDER_CHANNEL=BASE;