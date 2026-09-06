import os, requests

class NewsroomBridge:
    def __init__(self, base_url, token):
        self.base=base_url.rstrip('/')
        self.headers={'Authorization':f'Bearer {token}'}

    def pull(self, limit=5):
        r=requests.get(f'{self.base}/ai-newsroom/pull',params={'limit':limit},headers=self.headers,timeout=30)
        r.raise_for_status(); return r.json().get('items',[])

    def claim(self, item_id):
        r=requests.post(f'{self.base}/ai-newsroom/claim',json={'id':item_id},headers=self.headers,timeout=30)
        r.raise_for_status(); return r.json()

    def result(self, item_id, result):
        r=requests.post(f'{self.base}/ai-newsroom/result',json={'id':item_id,'result':result},headers=self.headers,timeout=30)
        r.raise_for_status(); return r.json()

    def status(self):
        r=requests.get(f'{self.base}/ai-newsroom/status',headers=self.headers,timeout=30)
        r.raise_for_status(); return r.json()


def process_once(bridge, ai_edit, final_gate, limit=5):
    done=[]
    for item in bridge.pull(limit):
        bridge.claim(item['id'])
        try:
            result=ai_edit(item)
            result['publish_decision']=final_gate(result)
            bridge.result(item['id'],result)
            done.append({'id':item['id'],'decision':result['publish_decision']})
        except Exception as e:
            bridge.result(item['id'],{'publish_decision':'review','error':str(e)[:300]})
    return done
