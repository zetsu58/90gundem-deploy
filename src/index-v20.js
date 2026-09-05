import live from './index-v13.js';
import { backfill2h } from './backfill-2h.js';

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.pathname === '/backfill-2h') {
      try { return Response.json(await backfill2h(env)); }
      catch (e) { return Response.json({status:'error',version:'backfill-2h-v1',error:String(e?.message||e)}, {status:500}); }
    }
    if (u.pathname === '/health') {
      const r = await live.fetch(req, env, ctx);
      let d = {}; try { d = await r.clone().json(); } catch {}
      return Response.json({...d,version:'speed-publish-v20',backfill_2h:true,backfill_max_posts:10});
    }
    return live.fetch(req, env, ctx);
  },
  async scheduled(event, env, ctx) { return live.scheduled(event, env, ctx); }
};
