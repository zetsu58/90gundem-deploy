"""Free V22 preflight/self-test. No GitHub Actions and no paid API calls."""
from urllib.parse import urlparse

def _dom(u):
    try:return urlparse(u or '').netloc.lower().removeprefix('www.')
    except:return ''

def _fuse(evidence,ai,n,official,viral):
    final=round(evidence*.65+ai*.35)
    if n<2 and not official: final=min(final,69)
    if n<2 and official: final=min(90,max(final,75))
    decision='reject' if final<55 else ('review' if final<75 or viral<45 else 'publish')
    return final,decision

def _image(score,usable=True):
    return 'drop_image' if score<35 else ('review_or_replace' if score<55 or not usable else 'use')

def run_selftest():
    checks=[]
    def check(name,condition):
        if not condition: raise AssertionError(name)
        checks.append(name)
    v,d=_fuse(95,100,1,False,90);check('single-source-cap',v==69 and d=='review')
    v,d=_fuse(90,90,1,True,80);check('official-controlled-pass',v>=75 and d=='publish')
    check('strong-two-source',_fuse(90,90,2,False,80)[1]=='publish')
    check('weak-verification-reject',_fuse(35,40,1,False,80)[1]=='reject')
    check('low-viral-review',_fuse(95,95,2,False,20)[1]=='review')
    check('image-drop',_image(20)=='drop_image')
    check('image-review',_image(50)=='review_or_replace')
    check('image-use',_image(80,True)=='use')
    check('domain-normalization',_dom('https://www.reuters.com/a')=='reuters.com')
    return {'ok':True,'passed':len(checks),'checks':checks}

if __name__=='__main__':
    r=run_selftest();print(f"✅ V22 SELF-TEST {r['passed']}/{r['passed']} PASSED")
