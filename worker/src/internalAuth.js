// Signed internal auth for landing Worker -> API calls over the service binding.
// Header: X-Internal-Auth: v1.<kid>.<ts>.<sig>
//   kid = key id, [a-z0-9]{1,16}, looked up in INTERNAL_PROXY_KEYS (JSON {kid: base64key}); two kids may overlap for rotation.
//   ts  = Unix seconds (decimal), accepted within +/-60 s of the API clock.
//   sig = base64url (no padding) HMAC-SHA256(key, canonical) where canonical =
//         "v1\n" + kid + "\n" + METHOD + "\n" + pathname+search + "\n" + ts + "\n" + ip + "\n" + hex(SHA-256(body))
//         METHOD upper-case; ip = the exact CF-Connecting-IP header value sent ("" if absent); empty body = SHA-256("").
// Valid only on INTERNAL_ROUTES (every route the landing proxy forwards, GETs included). A valid header replaces the
// X-CSRF-Token check and makes CF-Connecting-IP trusted for rate limits. The session cookie is still required.
// Any failure is the uniform 403 {"error":"forbidden"}. Keys under 32 bytes, or equal to another secret, are dropped at load.
import { timingSafeEqual, unb64 } from './crypto.js';

export const INTERNAL_HEADER = 'X-Internal-Auth';
export const INTERNAL_SKEW_SECONDS = 60;
export const MIN_KEY_BYTES = 32;
export const MAX_BODY_BYTES = 64 * 1024; // matches the landing proxy cap; checked before any hashing
export const TOO_LARGE = 'too_large';
// Every route the landing /api proxy forwards (README "Landing proxy contract").
export const INTERNAL_ROUTES = [
  ['GET', /^\/api\/me$/],
  ['GET', /^\/api\/auth\/(google|microsoft)\/start$/],
  ['GET', /^\/api\/auth\/complete$/],
  ['POST', /^\/api\/auth\/logout$/],
  ['POST', /^\/api\/auth\/stepup\/password$/],
  ['POST', /^\/api\/auth\/(google|microsoft)\/stepup$/],
  ['GET', /^\/api\/account\/profile$/],
  ['PATCH', /^\/api\/account\/profile$/],
  ['GET', /^\/api\/account\/optouts$/],
  ['GET', /^\/api\/account\/sessions$/],
  ['POST', /^\/api\/account\/sessions\/[0-9a-f]{16}\/revoke$/],
  ['POST', /^\/api\/account\/export$/],
  ['POST', /^\/api\/account\/delete$/],
  ['POST', /^\/api\/account\/identities\/(google|microsoft)\/link$/],
  ['DELETE', /^\/api\/account\/identities\/(google|microsoft)$/],
  ['POST', /^\/api\/optouts\/signup$/],
];
export const internalRouteAllowed = (method, path) => INTERNAL_ROUTES.some(([m, re]) => m === method && re.test(path));

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const KID = /^[a-z0-9]{1,16}$/;
const OTHER_SECRETS = ['PII_ENC_KEY', 'PII_ENC_KEY_PREV', 'TOTP_ENC_KEY', 'OAUTH_COOKIE_KEY', 'SIGNUP_PII_KEY'];

const cache = new WeakMap();
/** Parses INTERNAL_PROXY_KEYS once per env. Drops bad kids, non-base64 values, keys < 32 bytes and reused secrets. */
export function loadInternalKeys(env) {
  if (cache.has(env)) return cache.get(env);
  const out = new Map();
  let map = {};
  try { map = JSON.parse(String(env.INTERNAL_PROXY_KEYS || '{}')); } catch { map = {}; }
  const others = new Set(OTHER_SECRETS.map((n) => String(env[n] || '')).filter(Boolean));
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    for (const [kid, v] of Object.entries(map)) {
      if (!KID.test(kid) || typeof v !== 'string' || others.has(v)) continue;
      let bytes; try { bytes = unb64(v); } catch { continue; }
      if (bytes.length < MIN_KEY_BYTES) continue;
      out.set(kid, bytes);
    }
  }
  cache.set(env, out);
  return out;
}

async function sha256HexBytes(body) {
  return hex(await crypto.subtle.digest('SHA-256', typeof body === 'string' ? enc.encode(body) : (body || new Uint8Array())));
}
export const canonical = (kid, method, pathAndQuery, ts, ip, bodyHash) =>
  `v1\n${kid}\n${method.toUpperCase()}\n${pathAndQuery}\n${ts}\n${ip}\n${bodyHash}`;

/** keyBytes: Uint8Array. Returns the full header value. */
export async function signInternal(keyBytes, kid, method, pathAndQuery, ts, ip, body) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg = canonical(kid, method, pathAndQuery, ts, ip, await sha256HexBytes(body));
  return `v1.${kid}.${ts}.${b64url(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))}`;
}

// Reads at most MAX_BODY_BYTES from a clone of the body; null if it is larger.
async function readCapped(req) {
  if (!req.body) return new Uint8Array();
  const reader = req.clone().body.getReader();
  const parts = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > MAX_BODY_BYTES) { await reader.cancel(); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}

/** true for a valid, fresh header from a known kid on an allowed route; TOO_LARGE for a body over 64 KB; else false. */
export async function verifyInternal(req, env, path, nowSec = Math.floor(Date.now() / 1000)) {
  const h = req.headers.get(INTERNAL_HEADER) || '';
  const m = h.match(/^v1\.([a-z0-9]{1,16})\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/);
  if (!m || !internalRouteAllowed(req.method, path)) return false;
  const key = loadInternalKeys(env).get(m[1]);
  if (!key) return false;
  if (Math.abs(nowSec - Number(m[2])) > INTERNAL_SKEW_SECONDS) return false;
  if (Number(req.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return TOO_LARGE; // before any body read or hash
  const u = new URL(req.url);
  const body = req.method === 'GET' || req.method === 'HEAD' ? new Uint8Array() : await readCapped(req);
  if (body === null) return TOO_LARGE;
  const want = await signInternal(key, m[1], req.method, u.pathname + u.search, m[2], req.headers.get('CF-Connecting-IP') ?? '', body);
  return timingSafeEqual(want, h);
}
