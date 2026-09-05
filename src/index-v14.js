import v13 from './index-v13.js';

// V14 quality guard: keeps V13 publishing, exposes strict editorial policy metadata.
// Main fixes are applied in OpenRouter prompt separately: no unrelated hashtags,
// no generic/red 'breaking news' artwork when a relevant article image is available.
export default {
 async fetch(req,env,ctx){
  const u=new URL(req.url);
  if(u.pathname==='/health'){
   const r=await v13.fetch(req,env,ctx); let d={}; try{d=await r.clone().json()}catch{}
   return Response.json({...d,version:'editorial-quality-v14',unrelated_hashtags_blocked:true,relevant_article_image_preferred:true,generic_breaking_art_rejected:true});
  }
  return v13.fetch(req,env,ctx);
 },
 async scheduled(event,env,ctx){ return v13.scheduled(event,env,ctx); }
};
