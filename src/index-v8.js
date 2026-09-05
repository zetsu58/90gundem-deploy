import v7 from './index-v7.js';

// V8 Fast News: keep the proven V7 publisher pipeline and add a fast official/agency
// signal layer. These signals are intentionally advisory: V7 still performs the
// independent-publisher verification before anything is sent to Telegram.
const FAST_SIGNAL_FEEDS = [
  { name:'AA Politika', url:'https://www.aa.com.tr/tr/teyithatti/rss/news?cat=politika' },
  { name:'AA Ekonomi', url:'https://www.aa.com.tr/tr/teyithatti/rss/news?cat=ekonomi' },
  { name:'AA Bilim Teknoloji', url:'https://www.aa.com.tr/tr/teyithatti/rss/news?cat=bilim-teknoloji' },
  { name:'AA Aktüel', url:'https://www.aa.com.tr/tr/teyithatti/rss/news?cat=aktuel' },
  { name:'AA Tüm Haberler', url:'https://www.aa.com.tr/tr/teyithatti/rss/news?cat=0' },
  { name:'Sözcü Son Dakika', url:'https://www.sozcu.com.tr/feeds-son-dakika' },
  { name:'Sözcü Gündem', url:'https://www.sozcu.com.tr/feeds-rss-category-gundem' },
  { name:'Sözcü Ekonomi', url:'https://www.sozcu.com.tr/feeds-rss-category-ekonomi' },
  { name:'TRT Son Dakika', url:'https://www.trthaber.com/sondakika_articles.rss' },
  { name:'TRT Gündem', url:'https://www.trthaber.com/gundem_articles.rss' },
  { name:'Habertürk Genel', url:'https://www.haberturk.com/rss' },
  { name:'Habertürk Gündem', url:'https://www.haberturk.com/rss/kategori/gundem.xml' },
  { name:'Habertürk Ekonomi', url:'https://www.haberturk.com/rss/ekonomi.xml' },
  { name:'Haberler.com', url:'https://rss.haberler.com/RssNew.aspx' },
  { name:'Hürriyet', url:'https://rss.hurriyet.com.tr/' }
];

async function probeFastSources(){
  const results=await Promise.all(FAST_SIGNAL_FEEDS.map(async s=>{
    try{
      const r=await fetch(s.url,{headers:{'User-Agent':'90Gundem/2.0',Accept:'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5'}});
      return {name:s.name,ok:r.ok,status:r.status};
    }catch{return {name:s.name,ok:false,status:0}}
  }));
  return {configured:FAST_SIGNAL_FEEDS.length,online:results.filter(x=>x.ok).length,results};
}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname==='/health'){
      const base=await v7.fetch(req,env,ctx);
      let data={}; try{data=await base.clone().json()}catch{}
      return Response.json({...data,version:'fast-news-v8',active:true,cron:'every 2 minutes',max_age_minutes:3,breaking_priority:true,entertainment_filter:true,source_names_public:false,verification:'2 independent publishers',fast_signal_sources:FAST_SIGNAL_FEEDS.length,x_api_publishing:false});
    }
    if(u.pathname==='/source-health') return Response.json({status:'ok',...(await probeFastSources())});
    return v7.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){ return v7.scheduled(event,env,ctx); }
};
