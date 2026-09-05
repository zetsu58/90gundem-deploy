function compact(s,n){s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n-1).trimEnd()+"…":s}
function parseObject(text=""){
  let s=String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();
  try{return JSON.parse(s)}catch{}
  const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
  const title=s.match(/(?:title|başlık)\s*[:=-]\s*["“]?([^\n"”]{10,140})/i)?.[1];
  const summary=s.match(/(?:summary|özet)\s*[:=-]\s*["“]?([^\n]{20,400})/i)?.[1];
  if(title&&summary)return{title,summary,hashtags:(s.match(/#[\p{L}\p{N}_]+/gu)||[]).slice(0,7)};
  return null;
}
function topicTags(text=""){
  const n=String(text).toLocaleLowerCase("tr-TR"),out=["#SonDakika","#Gündem"],rules=[["erdoğan","#Erdoğan"],["cumhurbaşkanı","#Cumhurbaşkanı"],["galatasaray","#Galatasaray"],["fenerbahçe","#Fenerbahçe"],["beşiktaş","#Beşiktaş"],["trabzonspor","#Trabzonspor"],["futbol","#Futbol"],["emekli","#Emeklilik"],["eyt","#EYT"],["kpss","#KPSS"],["deprem","#Deprem"],["ekonomi","#Ekonomi"],["altın","#Altın"],["dolar","#Dolar"],["meclis","#TBMM"],["sağlık","#Sağlık"],["teknoloji","#Teknoloji"]];
  for(const[k,t]of rules)if(n.includes(k)&&!out.includes(t))out.push(t);return out.slice(0,7)
}
function fallback(cluster,raw="",model=null){const p=cluster.primary||{};return{...p,title:compact(p.title,110),description:compact(p.description||"Gelişmeler doğrulanmış kaynaklardan takip ediliyor.",300),ai_hashtags:topicTags(`${p.title} ${p.description||""}`),visual_prompt:"realistic editorial news scene related to the headline, neutral documentary photography, no text, no logo, no watermark",ai_used:false,ai_fallback:true,ai_model:model,ai_raw_preview:compact(raw,180)}}
export async function enrichNews(env,cluster){
  if(!env.OPENROUTER_API_KEY)return fallback(cluster);
  const evidence=cluster.items.slice(0,6).map((x,i)=>`${i+1}. ${x.publisher}: ${x.title}${x.description?` — ${compact(x.description,500)}`:""}`).join("\n");
  const prompt=`Sen +90 GÜNDEM haber editörüsün. Sadece KANITLAR bölümündeki olguları kullan; hiçbir isim, sayı, tarih, yer, neden, sonuç veya alıntı uydurma. Aynı olayı tarafsız Türkçe tek haber yap. SADECE şu JSON nesnesini döndür: {"title":"...","summary":"...","hashtags":["#SonDakika","#Gündem","#Konu"],"visual_prompt":"..."}. title en fazla 110 karakter, summary 1-2 cümle ve en fazla 300 karakter, 4-7 alakalı hashtag. visual_prompt İngilizce, gerçekçi editoryal arka plan, yazı/logo/watermark yok.\nKANITLAR:\n${evidence}`;
  const base={model:env.OPENROUTER_MODEL||"openrouter/free",messages:[{role:"system",content:"You are a Turkish news editor. Output one valid JSON object only."},{role:"user",content:prompt}],temperature:0,max_tokens:650};
  let r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,"Content-Type":"application/json","HTTP-Referer":"https://90gundem-deploy.zambakste.workers.dev","X-Title":"90+ Gündem"},body:JSON.stringify(base)});
  if(!r.ok)throw new Error(`openrouter_http_${r.status}:${(await r.text()).slice(0,240)}`);
  let j=await r.json(),msg=j?.choices?.[0]?.message||{},raw=msg.content;
  if(Array.isArray(raw))raw=raw.map(x=>typeof x==="string"?x:(x?.text||x?.content||"")).join("\n");
  if(!raw&&msg.reasoning)raw=msg.reasoning;
  const model=j.model||base.model,o=parseObject(raw||"");if(!o)return fallback(cluster,raw||"",model);
  const tags=Array.isArray(o.hashtags)?o.hashtags.map(x=>String(x).trim()).filter(x=>x.startsWith("#")).slice(0,7):[];
  return{...cluster.primary,title:compact(o.title||cluster.primary.title,110),description:compact(o.summary||cluster.primary.description,300),ai_hashtags:tags.length>=2?tags:topicTags(`${o.title||""} ${o.summary||""}`),visual_prompt:compact(o.visual_prompt||"realistic neutral editorial news photography, no text, no logo, no watermark",500),ai_used:true,ai_fallback:false,ai_model:model,ai_raw_preview:compact(raw||"",180)}
}
