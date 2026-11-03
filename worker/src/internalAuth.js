// Signed internal auth for landing Worker -> API calls over the service binding.
// Header: X-Internal-Auth: v1.<ts>.<sig>
//   ts  = Unix seconds (decimal, no sign/fraction), accepted within +/-60 s of the API clock.
//   sig = base64url (no padding) HMAC-SHA256(INTERNAL_PROXY_KEY, "v1\n" + METHOD + "\n" + path+query + "\n" + ts + "\n" + hex(SHA-256(body)))
//         METHOD upper-case; path+query exactly as sent (e.g. "/api/optouts/signup"); empty body hashes "" (e3b0c442...).
// A valid header replaces the X-CSRF-Token check, only on INTERNAL_ROUTES. The session cookie is still required, so
// the call stays scoped to the signed-in user. Any failure (bad format, skew, wrong route, bad sig, key unset) is the
// same uniform 403 {"error":"forbidden"} as a CSRF failure. Browser calls to the accounts host never carry this header
// and keep normal Origin + CSRF checks. INTERNAL_PROXY_KEY is a secret (wrangler secret put), never in config.
import { timingSafeEqual } from './crypto.js';

export const INTERNAL_HEADER = 'X-Internal-Auth';
export const INTERNAL_SKEW_SECONDS = 60;
// State-changing routes the landing /api proxy forwards (see README "Landing proxy contract").
export const INTERNAL_ROUTES = [
  ['POST', /^\/api\/optouts\/signup$/],
  ['POST', /^\/api\/auth\/logout$/],
  ['POST', /^\/api\/auth\/stepup\/password$/],
  ['POST', /^\/api\/auth\/(google|microsoft)\/stepup$/],
  ['PATCH', /^\/api\/account\/profile$/],
  ['POST', /^\/api\/account\/sessions\/[0-9a-f]{16}\/revoke$/],
  ['POST', /^\/api\/account\/export$/],
  ['POST', /^\/api\/account\/delete$/],
  ['POST', /^\/api\/account\/identities\/(google|microsoft)\/link$/],
  ['DELETE', /^\/api\/account\/identities\/(google|microsoft)$/],
];
export const internalRouteAllowed = (method, path) => INTERNAL_ROUTES.some(([m, re]) => m === method && re.test(path));

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function signInternal(key, method, pathAndQuery, ts, body) {
  const bodyHash = hex(await crypto.subtle.digest('SHA-256', typeof body === 'string' ? enc.encode(body) : (body || new Uint8Array())));
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg = `v1\n${method.toUpperCase()}\n${pathAndQuery}\n${ts}\n${bodyHash}`;
  return `v1.${ts}.${b64url(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))}`;
}

/** Returns true only for a valid, fresh header on an allowed route. Reads a clone of the body. */
export async function verifyInternal(req, env, path, nowSec = Math.floor(Date.now() / 1000)) {
  const h = req.headers.get(INTERNAL_HEADER) || '';
  const key = String(env.INTERNAL_PROXY_KEY || '');
  const m = h.match(/^v1\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/);
  if (!key || !m || !internalRouteAllowed(req.method, path)) return false;
  const ts = Number(m[1]);
  if (Math.abs(nowSec - ts) > INTERNAL_SKEW_SECONDS) return false;
  const u = new URL(req.url);
  const body = new Uint8Array(await req.clone().arrayBuffer());
  const want = await signInternal(key, req.method, u.pathname + u.search, m[1], body);
  return timingSafeEqual(want, h);
}
