import worker from "./index.js";

function esc(v=""){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function cardHtml(item={}){
  const title=esc(item.title||"+90 GÜNDEM görsel sistemi aktif");
  const desc=esc(item.description||"Doğrulanmış haberler yapay zeka editöründen geçerek markalı görsel kart halinde hazırlanacak.");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1080px;overflow:hidden;font-family:Arial,sans-serif;background:#090b10;color:#fff}.card{width:1080px;height:1080px;padding:64px;background:radial-gradient(circle at 85% 12%,#501018 0,#17131a 26%,#090b10 58%);position:relative}.top{display:flex;align-items:center;gap:24px}.logo{width:118px;height:118px;border-radius:59px;background:#e41f2b;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:900}.brand{font-size:56px;font-weight:900;letter-spacing:1px}.brand span{color:#e41f2b}.breaking{margin-top:70px;display:inline-block;background:#e41f2b;padding:14px 28px;border-radius:10px;font-size:28px;font-weight:800;letter-spacing:2px}.title{font-size:62px;line-height:1.08;font-weight:900;margin-top:30px;max-height:270px;overflow:hidden}.line{width:170px;height:8px;background:#e41f2b;margin:36px 0}.desc{font-size:31px;line-height:1.42;color:#e6e6e8;max-height:225px;overflow:hidden}.footer{position:absolute;left:64px;right:64px;bottom:58px;border-top:1px solid #555;padding-top:24px;display:flex;justify-content:space-between;font-size:24px;color:#bbb}.tag{color:#fff;font-weight:700}</style></head><body><div class="card"><div class="top"><div class="logo">90+</div><div class="brand"><span>+90</span> GÜNDEM</div></div><div class="breaking">SON DAKİKA</div><div class="title">${title}</div><div class="line"></div><div class="desc">${desc}</div><div class="footer"><span class="tag">Doğrulanmış Haber</span><span>90+ GÜNDEM</span></div></div></body></html>`;
}
async function renderCard(env,item){
  if(!env.BROWSER)throw new Error("BROWSER binding missing");
  const r=await env.BROWSER.quickAction("screenshot",{html:cardHtml(item),viewport:{width:1080,height:1080},screenshotOptions:{type:"png",fullPage:false}});
  if(!r.ok)throw new Error(`browser_screenshot_${r.status}: ${await r.text()}`);
  return r;
}
export default {
  async fetch(request,env,ctx){
    const u=new URL(request.url);
    if(u.pathname==="/image-test"){
      try{
        const r=await renderCard(env,{title:"+90 GÜNDEM görsel sistemi aktif",description:"Doğrulanmış haberler yapay zeka editöründen geçerek markalı görsel kart halinde hazırlanacak."});
        return new Response(r.body,{headers:{"Content-Type":r.headers.get("Content-Type")||"image/png","Cache-Control":"no-store"}});
      }catch(e){return Response.json({status:"error",browser_binding:Boolean(env.BROWSER),error:String(e?.message||e)},{status:500})}
    }
    return worker.fetch(request,env,ctx);
  },
  async scheduled(controller,env,ctx){return worker.scheduled(controller,env,ctx)}
};
