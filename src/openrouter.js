function cleanJson(text=""){
  const s=String(text).trim().replace(/^```(?:json)?/i,"").replace(/```$/i,"").trim();
  const a=s.indexOf("{"),b=s.lastIndexOf("}");
  if(a<0||b<a) throw new Error("openrouter_invalid_json");
  return JSON.parse(s.slice(a,b+1));
}
function compact(s,n){s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n-1).trimEnd()+"…":s}
export async function enrichNews(env,cluster){
  if(!env.OPENROUTER_API_KEY) return {...cluster.primary,ai_used:false};
  const evidence=cluster.items.slice(0,6).map((x,i)=>`${i+1}. ${x.publisher}: ${x.title}${x.description?` — ${compact(x.description,500)}`:""}`).join("\n");
  const prompt=`Aşağıdaki doğrulanmış Türkçe haber kaynaklarını kullan. YALNIZCA verilen kanıtlardaki olguları kullan; isim, sayı, tarih, neden veya sonuç uydurma. Aynı olayı tek haber haline getir. Tarafsız ve profesyonel haber dili kullan. JSON dışında hiçbir şey yazma.\n\nJSON şeması:\n{"title":"en fazla 110 karakter","summary":"1-2 cümle, en fazla 300 karakter","hashtags":["#SonDakika","#..."],"visual_prompt":"haberi temsil edecek, yazısız ve logosuz gerçekçi editoryal görsel için İngilizce prompt"}\n\nKurallar: 4-7 alakalı hashtag; görsel promptunda metin/logo/watermark isteme; belirsiz bilgiyi kesinleştirme.\n\nKANITLAR:\n${evidence}`;
  const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,"Content-Type":"application/json","HTTP-Referer":"https://90gundem-deploy.zambakste.workers.dev","X-Title":"90+ Gündem"},body:JSON.stringify({model:env.OPENROUTER_MODEL||"openrouter/free",messages:[{role:"user",content:prompt}],temperature:.2,max_tokens:450})});
  if(!r.ok) throw new Error(`openrouter_http_${r.status}:${(await r.text()).slice(0,240)}`);
  const j=await r.json(),raw=j?.choices?.[0]?.message?.content;
  if(!raw) throw new Error("openrouter_empty_response");
  const o=cleanJson(raw),tags=Array.isArray(o.hashtags)?o.hashtags.map(x=>String(x).trim()).filter(x=>x.startsWith("#")).slice(0,7):[];
  return {...cluster.primary,title:compact(o.title||cluster.primary.title,110),description:compact(o.summary||cluster.primary.description,300),ai_hashtags:tags,visual_prompt:compact(o.visual_prompt||"",500),ai_used:true,ai_model:j.model||env.OPENROUTER_MODEL||"openrouter/free"};
}
