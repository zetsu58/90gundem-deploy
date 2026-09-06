import requests, base64, json

IMAGE_SYSTEM='''You are a conservative news image relevance checker. Compare the supplied news context with the image. Do not identify an unknown person by face. Judge only visible evidence such as team/organization marks, readable context, setting, objects and whether the image plausibly illustrates the stated story. Return JSON only: image_relevance_score (0-100), usable (boolean), reasons (array), visible_context (array). If uncertain, score low. A generic but related illustrative image should not score above 70.''' 

def _data_url(url):
 r=requests.get(url,timeout=20,headers={'User-Agent':'Mozilla/5.0'});r.raise_for_status()
 ct=r.headers.get('content-type','image/jpeg').split(';')[0]
 if not ct.startswith('image/'):raise ValueError('not_an_image')
 raw=r.content
 if len(raw)>8_000_000:raise ValueError('image_too_large')
 return f'data:{ct};base64,'+base64.b64encode(raw).decode()

def check_image(openrouter_key,model,article,image_url):
 if not image_url:return {'image_relevance_score':0,'usable':False,'reasons':['image_missing'],'visible_context':[]}
 try:
  data=_data_url(image_url)
  payload={'model':model,'temperature':0,'response_format':{'type':'json_object'},'messages':[{'role':'system','content':IMAGE_SYSTEM},{'role':'user','content':[{'type':'text','text':'News context: '+json.dumps({'title':article.get('title'),'description':article.get('description'),'category':article.get('category'),'entities':article.get('entities')},ensure_ascii=False)},{'type':'image_url','image_url':{'url':data}}]}]}
  r=requests.post('https://openrouter.ai/api/v1/chat/completions',headers={'Authorization':f'Bearer {openrouter_key}','Content-Type':'application/json'},json=payload,timeout=75);r.raise_for_status()
  out=json.loads(r.json()['choices'][0]['message']['content']);out['image_relevance_score']=max(0,min(100,int(out.get('image_relevance_score',0))));out['usable']=bool(out.get('usable')) and out['image_relevance_score']>=55;return out
 except Exception as e:return {'image_relevance_score':0,'usable':False,'reasons':['image_check_failed',str(e)[:160]],'visible_context':[]}

def apply_image_gate(result,image_check):
 result['image_check']=image_check
 score=image_check.get('image_relevance_score',0)
 # Yanlış görsel haberi engellemez; görselsiz/manual review yoluna iter.
 result['use_source_image']=bool(image_check.get('usable')) and score>=55
 if result.get('publish_decision')=='publish' and score<35:
  result['image_action']='drop_image'
 elif score<55:result['image_action']='review_or_replace'
 else:result['image_action']='use'
 return result
