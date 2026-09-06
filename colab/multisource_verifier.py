from urllib.parse import urlparse
from rapidfuzz.fuzz import token_set_ratio

SOURCE_TRUST={
 'aa.com.tr':95,'trthaber.com':90,'resmigazete.gov.tr':100,'kap.org.tr':100,
 'tff.org':98,'uefa.com':98,'fifa.com':98,
 'reuters.com':98,'apnews.com':98,'bbc.com':94,
 'ntv.com.tr':86,'haberturk.com':84,'hurriyet.com.tr':80,'milliyet.com.tr':80,
 'fanatik.com.tr':74,'fotomac.com.tr':72
}

def domain(url):
 try:return urlparse(url).netloc.lower().removeprefix('www.')
 except:return ''

def trust(url):
 d=domain(url)
 if d in SOURCE_TRUST:return SOURCE_TRUST[d]
 return 55 if d else 35

def cluster_story(primary,candidates,threshold=67):
 base=(primary.get('title','')+' '+primary.get('description','')).strip()
 matches=[]
 for x in candidates:
  text=(x.get('title','')+' '+x.get('description','')).strip()
  sim=token_set_ratio(base,text)
  if sim>=threshold:matches.append({**x,'similarity':sim,'source_trust':trust(x.get('link',''))})
 return sorted(matches,key=lambda x:(x['source_trust'],x['similarity']),reverse=True)

def evidence_score(primary,matches):
 all_items=[{**primary,'source_trust':trust(primary.get('link',''))}]+matches
 domains={domain(x.get('link','')) for x in all_items if domain(x.get('link',''))}
 independent=len(domains)
 official=max([x.get('source_trust',0) for x in all_items] or [0])>=98
 avg=sum(x.get('source_trust',0) for x in all_items)/max(1,len(all_items))
 score=35+min(30,max(0,independent-1)*15)+min(20,avg*.20)+(15 if official else 0)
 return min(100,round(score))

def evidence_bundle(primary,candidates):
 matches=cluster_story(primary,candidates)
 return {
  'primary':primary,
  'corroborating_sources':matches[:5],
  'independent_source_count':len({domain(x.get('link','')) for x in [primary]+matches if domain(x.get('link',''))}),
  'evidence_score':evidence_score(primary,matches),
  'official_or_wire_confirmed':any(trust(x.get('link',''))>=98 for x in [primary]+matches)
 }
