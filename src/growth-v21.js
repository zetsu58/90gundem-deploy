const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLocaleLowerCase('tr-TR');

export function growthScore(i){
  const t=norm(`${i.title} ${i.description}`);
  let score=0;
  if(/son dakika|breaking|acil/.test(t)) score+=30;
  if(/fenerbahçe|galatasaray|beşiktaş|trabzonspor|milli takım|cumhurbaşkanı|bakan/.test(t)) score+=20;
  if(/transfer|istifa|sakatlık|kadro|gol|maç|açıklama|anlaşma|imza|deprem/.test(t)) score+=15;
  if(i.image) score+=10;
  if(i.ai_used) score+=10;
  if(i.link) score+=5;
  return Math.min(100,score);
}

function hashtag(i){
 const t=norm(`${i.title} ${i.description}`);
 if(t.includes('fenerbahçe')) return '#Fenerbahçe';
 if(t.includes('galatasaray')) return '#Galatasaray';
 if(t.includes('beşiktaş')) return '#Beşiktaş';
 if(t.includes('trabzonspor')) return '#Trabzonspor';
 if(/milli takım|türkiye/.test(t)) return '#Türkiye';
 return '';
}

export function growthXText(i){
 const title=clean(i.title).replace(/^🔴\s*/,'');
 const desc=clean(i.description);
 const breaking=/son dakika|breaking|acil/.test(norm(`${title} ${desc}`));
 const lead=breaking?'🔴 SON DAKİKA | ':'⚡ ';
 const body=desc && desc.toLocaleLowerCase('tr-TR')!==title.toLocaleLowerCase('tr-TR') ? desc.slice(0,105).replace(/\s+\S*$/,'') : '';
 const tag=hashtag(i);
 return `${lead}${title.slice(0,125)}${body?`\n\n${body}`:''}${tag?`\n\n${tag}`:''}`.slice(0,275);
}

export function growthDecision(i,env={}){
 const score=growthScore(i);
 const min=Number(env.GROWTH_MIN_SCORE||50);
 return {score,action:score>=min?'publish':'skip',has_image:Boolean(i.image),min_score:min};
}

export async function ensureGrowthTables(env){
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS growth_events(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   fingerprint TEXT,
   title TEXT NOT NULL,
   score INTEGER NOT NULL,
   action TEXT NOT NULL,
   has_image INTEGER NOT NULL DEFAULT 0,
   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 )`).run();
}

export async function recordGrowthEvent(env,i,decision,fingerprint=''){
 await ensureGrowthTables(env);
 await env.DB.prepare('INSERT INTO growth_events(fingerprint,title,score,action,has_image) VALUES(?,?,?,?,?)')
   .bind(fingerprint,clean(i.title),decision.score,decision.action,decision.has_image?1:0).run();
}
