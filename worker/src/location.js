// Every Location this Worker sends must be one of these, or the response becomes a 500 (never an open redirect).
//   app origin (/api/*, the routes the landing proxy forwards):
//     - a same-origin path: starts with one "/" (not "//" or "/\"), no scheme, no CR/LF;
//     - https://<ACCOUNTS_HOST>/oauth/{google|microsoft}/start?st=<token> (apex start hands the browser to the sign-in host).
//   accounts host (never proxied):
//     - a same-origin path;
//     - <APP_ORIGIN>/api/auth/complete?code=<base64url> and <APP_ORIGIN>/start[?auth_error=<reason>] (handoff back to the app);
//     - the exact Google / Microsoft authorize endpoints.
import { log } from './log.js';
export const AUTHORIZE_URLS = [
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
];
const samePath = (l) => /^\/(?![/\\])[^\s]*$/.test(l);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function locationAllowed(env, kind, loc) {
  if (typeof loc !== 'string' || /[\r\n]/.test(loc)) return false;
  if (samePath(loc)) return true;
  if (kind === 'app') {
    return new RegExp(`^https://${esc(String(env.ACCOUNTS_HOST || ''))}/oauth/(google|microsoft)/start\\?st=[A-Za-z0-9_.~%-]+$`).test(loc);
  }
  const app = esc(String(env.APP_ORIGIN || ''));
  if (app && new RegExp(`^${app}/api/auth/complete\\?code=[A-Za-z0-9_-]+$`).test(loc)) return true;
  if (app && new RegExp(`^${app}/start(\\?auth_error=[a-z_]+)?$`).test(loc)) return true;
  try {
    const u = new URL(loc);
    return AUTHORIZE_URLS.includes(u.origin + u.pathname) && !u.username && !u.password && !u.hash;
  } catch { return false; }
}

export function guardLocation(env, kind, res) {
  const loc = res.headers.get('Location');
  if (loc === null || locationAllowed(env, kind, loc)) return res;
  log('blocked_redirect', { kind });
  return new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
