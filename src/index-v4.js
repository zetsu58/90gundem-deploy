import worker from "./index.js";
import { renderNewsCard } from "./news-card-raster.js";
export default {
  async fetch(request,env,ctx){
    const u=new URL(request.url);
    if(u.pathname==="/image-test"){
      try{
        const bytes=await renderNewsCard(env,{title:"+90 GÜNDEM görsel sistemi aktif",description:"Doğrulanmış haberler yapay zeka editöründen geçerek markalı görsel kart halinde hazırlanacak."});
        return new Response(bytes,{headers:{"Content-Type":"image/jpeg","Cache-Control":"no-store"}});
      }catch(e){return Response.json({status:"error",image_binding:Boolean(env.IMAGES),error:String(e?.message||e)},{status:500})}
    }
    return worker.fetch(request,env,ctx);
  },
  async scheduled(controller,env,ctx){return worker.scheduled(controller,env,ctx)}
};
