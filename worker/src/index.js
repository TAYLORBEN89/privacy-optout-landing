// Entry: new D1 auth/opt-out API (/auth/*, /me, /optouts*) + legacy KV routes (/records, /txrequests, /settings).
import legacy from './legacy.js';
import { log, logError, routeOf } from './log.js';
import { handleApp, isAppPath, allowedOrigins, corsHeaders, purge, expireAudit, inactiveAccounts } from './app.js';
import { backfillUserEmails } from './userEmail.js';
import { handleApi } from './api.js';
import { handleAccounts } from './accounts.js';
import { guardLocation } from './location.js';
import { isBrokerPath, handleBroker, brokerPurge, monthlyLists, finishSignups, MONTHLY_CRON } from './brokerDelivery.js';

// Every response (accounts host, legacy KV routes, 403/OPTIONS early returns, app/API, 500s) gets exactly one
// request log line via src/log.js: method, normalized route, status, ms, and which surface served it. Nothing else.
async function route(req, env, pathname, hostname) {
  // Broker delivery API (server-to-server, per-broker bearer credentials) and its admin routes: any host, own auth.
  if (isBrokerPath(pathname)) {
    try { return [await handleBroker(req, env), 'broker']; } catch (e) {
      logError('broker_error', e, { method: req.method, route: routeOf(pathname) });
      return [new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }), 'broker'];
    }
  }
  // accounts.droptexas.com (ACCOUNTS_HOST) is the sign-in host: its own routes, origin rule and security headers.
  if (env.ACCOUNTS_HOST && hostname === env.ACCOUNTS_HOST) {
    try { return [guardLocation(env, 'accounts', await handleAccounts(req, env)), 'accounts']; } catch (e) {
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
    return [guardLocation(env, 'app', surface === 'api' ? await handleApi(req, env) : await handleApp(req, env)), surface];
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
  // One daily cron, one handler: runs every job independently (one failing job never stops the others) and logs
  // a failure by job name and error class only.
  // Two crons: daily (purges) and the 1st of each month (broker list build).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(event && event.cron === MONTHLY_CRON ? runScheduled(env, MONTHLY_JOBS) : runScheduled(env));
  },
};

export const SCHEDULED_JOBS = [
  ['purge', purge],
  ['audit_expiry', expireAudit], // the only audit_log delete path
  ['user_email_backfill', backfillUserEmails], // seals leftover plaintext users.email (100 rows per run)
  ['inactive_accounts', inactiveAccounts],
  ['signup_finish', (env) => finishSignups(env)], // sets finished_at once every list window (+45-day extension) closed
  ['broker_purge', (env) => brokerPurge(env)], // gated 24-month purge of broker tables
];
export const MONTHLY_JOBS = [['broker_lists', (env) => monthlyLists(env)]];
export async function runScheduled(env, jobs = SCHEDULED_JOBS) {
  const results = await Promise.allSettled(jobs.map(([, fn]) => fn(env)));
  results.forEach((r, i) => { if (r.status === 'rejected') logError('scheduled_job', r.reason, { job: jobs[i][0] }); });
  return results;
}
