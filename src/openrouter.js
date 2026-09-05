function compact(s,n){s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n-1).trimEnd()+"…":s}
function parseObject(text=""){
  let s=String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();
  try{return JSON.parse(s)}catch{}
  const a=s.indexOf("{"),b=s.lastIndexOf("}");
  if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
  return null;
}
function fallback(cluster,raw=""){
  const p=cluster.primary||{},tags=["#SonDakika","#Gündem"];
  return {...p,title:compact(p.title,110),description:compact(p.description||"Gelişmeler doğrulanmış kaynaklardan takip ediliyor.",300),ai_hashtags:tags,visual_prompt:"realistic neutral editorial news background, no text, no logo, no watermark",ai_used:false,ai_fallback:true,ai_raw_preview:compact(raw,120)};
}
export async function enrichNews(env,cluster){
  if(!env.OPENROUTER_API_KEY)return fallback(cluster);
  const evidence=cluster.items.slice(0,6).map((x,i)=>`${i+1}. ${x.publisher}: ${x.title}${x.description?` — ${compact(x.description,500)}`:""}`).join("\n");
  const prompt=`Sen +90 GÜNDEM haber editörüsün. Yalnızca aşağıdaki kanıtları kullan. İsim, sayı, tarih, neden, sonuç veya alıntı uydurma. Aynı olayı tarafsız Türkçe tek haber haline getir. Çıktın MUTLAKA geçerli tek bir JSON nesnesi olsun; markdown ve açıklama yazma.\nŞema: {"title":"maksimum 110 karakter","summary":"1-2 cümle maksimum 300 karakter","hashtags":["#SonDakika","#Gündem","#konu"],"visual_prompt":"English realistic editorial image prompt, no text, no logo, no watermark"}\n4-7 alakalı hashtag üret. Belirsiz bilgiyi kesinleştirme.\nKANITLAR:\n${evidence}`;
  const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,"Content-Type":"application/json","HTTP-Referer":"https://90gundem-deploy.zambakste.workers.dev","X-Title":"90+ Gündem"},body:JSON.stringify({model:env.OPENROUTER_MODEL||"openrouter/free",messages:[{role:"system",content:"Return only valid JSON. Never use markdown fences."},{role:"user",content:prompt}],temperature:0,max_tokens:500,response_format:{type:"json_object"}})});
  if(!r.ok)throw new Error(`openrouter_http_${r.status}:${(await r.text()).slice(0,240)}`);
  const j=await r.json(),raw=j?.choices?.[0]?.message?.content;
  if(!raw)return fallback(cluster,"");
  const o=parseObject(raw);
  if(!o)return fallback(cluster,raw);
  const tags=Array.isArray(o.hashtags)?o.hashtags.map(x=>String(x).trim()).filter(x=>x.startsWith("#")).slice(0,7):[];
  return {...cluster.primary,title:compact(o.title||cluster.primary.title,110),description:compact(o.summary||cluster.primary.description,300),ai_hashtags:tags.length?tags:["#SonDakika","#Gündem"],visual_prompt:compact(o.visual_prompt||"realistic neutral editorial news background, no text, no logo, no watermark",500),ai_used:true,ai_fallback:false,ai_model:j.model||env.OPENROUTER_MODEL||"openrouter/free"};
}
