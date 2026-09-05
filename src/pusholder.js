// Pusholder fast lane: public Telegram preview, treated as a trusted direct signal by editorial policy.
const CHANNEL='https://t.me/s/pusholder';
const dec=s=>String(s||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const attr=(s,n)=>{const m=String(s||'').match(new RegExp(`${n}=["']([^"']+)["']`,'i'));return m?.[1]||''};
export async function fetchPusholder(){
  try{
    const r=await fetch(CHANNEL,{headers:{'User-Agent':'Mozilla/5.0 (compatible; 90Gundem/20.0)'},redirect:'follow'});
    if(!r.ok)return[];
    const h=await r.text(),blocks=h.split('tgme_widget_message_wrap').slice(1,31),out=[];
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
    return out.sort((a,b)=>b.ts-a.ts);
  }catch{return[]}
}
export const PUSHOLDER_CHANNEL=CHANNEL;
