// Entry: new D1 auth/opt-out API (/auth/*, /me, /optouts*) + legacy KV routes (/records, /txrequests, /settings).
import legacy from './legacy.js';
import { log, logError, routeOf } from './log.js';
import { handleApp, isAppPath, allowedOrigins, corsHeaders, purge, expireAudit } from './app.js';
import { handleApi } from './api.js';
import { handleAccounts } from './accounts.js';

// Every response (accounts host, legacy KV routes, 403/OPTIONS early returns, app/API, 500s) gets exactly one
// request log line via src/log.js: method, normalized route, status, ms, and which surface served it. Nothing else.
async function route(req, env, pathname, hostname) {
  // accounts.droptexas.com (ACCOUNTS_HOST) is the sign-in host: its own routes, origin rule and security headers.
  if (env.ACCOUNTS_HOST && hostname === env.ACCOUNTS_HOST) {
    try { return [await handleAccounts(req, env), 'accounts']; } catch (e) {
      logError('accounts_error', e, { method: req.method, route: routeOf(pathname) }); // no stack/message: may carry values
      return [new Response('internal error', { status: 500, headers: { 'Cache-Control': 'no-store' } }), 'accounts'];
    }
  }
  // Sign-in host routes are never served on the app origin.
  if (pathname === '/signin' || pathname.startsWith('/oauth/')) return [new Response('Not found', { status: 404 }), 'app'];
  if (!isAppPath(pathname)) return [await legacy.fetch(req, env), 'legacy']; // unchanged legacy behaviour (shared API_TOKEN)
  const origin = req.headers.get('Origin');
  if (origin && !allowedOrigins(env).includes(origin)) return [new Response('Forbidden origin', { status: 403 }), 'app'];
  if (req.method === 'OPTIONS') return [new Response(null, { status: 204, headers: corsHeaders(env, origin) }), 'app'];
  const surface = pathname.startsWith('/api/') ? 'api' : 'app';
  try {
    return [surface === 'api' ? await handleApi(req, env) : await handleApp(req, env), surface];
  } catch (e) {
    logError('app_error', e, { method: req.method, route: routeOf(pathname) }); // error name only
    return [new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(env, origin) } }), surface];
  }
}

export default {
  async fetch(req, env) {
    const t0 = Date.now();
    const { pathname, hostname } = new URL(req.url);
    const [res, surface] = await route(req, env, pathname, hostname);
    log('request', { method: req.method, route: routeOf(pathname), status: res.status, ms: Date.now() - t0, surface });
    return res;
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(purge(env));
    ctx.waitUntil(expireAudit(env)); // separate job; the only audit_log delete path
  },
};
