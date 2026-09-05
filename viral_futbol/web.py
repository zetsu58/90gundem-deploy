from __future__ import annotations
import json, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
VERSION="90gundem-orbit-2026-09-05-v1"
def _truth(name,default="false"): return os.getenv(name,default).casefold() in {"1","true","yes","on"}
def status():
 from .config import Settings
 s=Settings(); names=("X_API_KEY","X_API_SECRET","X_ACCESS_TOKEN","X_ACCESS_TOKEN_SECRET")
 return {"status":"ok","version":VERSION,"configuration":{"dry_run":s.dry_run,"x_publish_enabled":_truth("X_PUBLISH_ENABLED"),"x_credentials_ready":all(os.getenv(n,"").strip() for n in names),"x_daily_post_limit":int(os.getenv("X_DAILY_POST_LIMIT","20")),"poll_seconds":s.poll_seconds,"x_max_age_minutes":s.x_max_age_minutes,"shorts_max_age_minutes":s.shorts_max_age_minutes}}
class Handler(BaseHTTPRequestHandler):
 def reply(self,code,payload):
  body=json.dumps(payload,ensure_ascii=False).encode(); self.send_response(code); self.send_header("Content-Type","application/json; charset=utf-8"); self.send_header("Cache-Control","no-store"); self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
 def do_GET(self):
  path=self.path.split("?",1)[0].rstrip("/") or "/"
  if path in {"/","/health","/status"}: return self.reply(200,status())
  if path=="/version": return self.reply(200,{"status":"ok","version":VERSION})
  if path=="/cycle":
   secret=os.getenv("CYCLE_SECRET","").strip()
   if not secret or self.headers.get("Authorization","") != f"Bearer {secret}": return self.reply(401,{"error":"unauthorized"})
   return self.reply(503,{"status":"deployment-ready","message":"cycle worker will be enabled after persistent state is attached"})
  self.reply(404,{"error":"not-found","path":path})
 def log_message(self,fmt,*args): print(fmt%args,flush=True)
def main():
 port=int(os.getenv("PORT","8080")); print(f"90+ Gundem starting {VERSION} port={port}",flush=True); ThreadingHTTPServer(("0.0.0.0",port),Handler).serve_forever()
if __name__=="__main__": main()
