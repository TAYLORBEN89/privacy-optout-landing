// Entry: new D1 auth/opt-out API (/auth/*, /me, /optouts*) + legacy KV routes (/records, /txrequests, /settings).
import legacy from './legacy.js';
import { handleApp, isAppPath, allowedOrigins, corsHeaders, purge } from './app.js';

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (!isAppPath(pathname)) return legacy.fetch(req, env); // unchanged legacy behaviour (shared API_TOKEN)
    const origin = req.headers.get('Origin');
    if (origin && !allowedOrigins(env).includes(origin)) return new Response('Forbidden origin', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
    try {
      return await handleApp(req, env);
    } catch (e) {
      console.error('app error', e && e.stack);
      return new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(env, origin) } });
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(purge(env));
  },
};
