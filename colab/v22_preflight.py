"""Mandatory V22 Colab preflight. Import and call require_preflight() before process_once()."""
import requests
from v22_selftest import run_selftest

def require_preflight(worker_url, token, timeout=20):
    local=run_selftest()
    if not local.get('ok') or local.get('passed',0)<9:
        raise RuntimeError('V22 local self-test failed; newsroom start blocked')
    if not worker_url or not token:
        raise RuntimeError('WORKER_URL / AI_NEWSROOM_TOKEN missing; newsroom start blocked')
    headers={'Authorization':f'Bearer {token}'}
    checks={}
    for name,path in [('status','/ai-newsroom/status'),('context','/ai-newsroom/context?hours=1&limit=10')]:
        try:
            r=requests.get(worker_url.rstrip('/')+path,headers=headers,timeout=timeout)
            checks[name]=r.status_code
            if r.status_code!=200:
                raise RuntimeError(f'{name} HTTP {r.status_code}')
            body=r.json()
            if body.get('status')!='ok':
                raise RuntimeError(f'{name} invalid response')
        except Exception as e:
            raise RuntimeError(f'V22 preflight {name} failed; newsroom start blocked: {e}') from e
    return {'ok':True,'local_tests':local['passed'],'worker_checks':checks}

if __name__=='__main__':
    print('Import this module from the V22 notebook and call require_preflight(WORKER_URL, AI_NEWSROOM_TOKEN).')
