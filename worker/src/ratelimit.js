// Fixed-window rate limiting with KV TTL counters: key "rl:<scope>:<sha256(id)>".
// KV is eventually consistent, so limits are approximate (fine for a single-user dashboard).
// Free-tier note: KV allows 1k writes/day, so login only counts FAILED attempts.
import { sha256Hex } from './crypto.js';

export const LIMITS = {
  login: { max: 5, windowSec: 900 },    // 5 failures / 15 min per IP+account (password and TOTP)
  optout: { max: 30, windowSec: 3600 }, // 30 writes / hour per user
  oauth_start: { max: 30, windowSec: 600 }, // OAuth flow starts / 10 min per IP
  oauth_cb: { max: 30, windowSec: 600 },    // OAuth callbacks / 10 min per IP
};

const key = async (scope, id) => `rl:${scope}:${await sha256Hex(id)}`;

export async function isLimited(env, scope, id) {
  const n = Number((await env.RECORDS.get(await key(scope, id))) || 0);
  return n >= LIMITS[scope].max;
}

export async function hit(env, scope, id) {
  const k = await key(scope, id);
  const n = Number((await env.RECORDS.get(k)) || 0) + 1;
  // KV min TTL is 60s. The window restarts on each hit (sliding-ish), which is stricter.
  await env.RECORDS.put(k, String(n), { expirationTtl: Math.max(60, LIMITS[scope].windowSec) });
  return n;
}

export const clientIp = (req) => req.headers.get('CF-Connecting-IP') || 'unknown';
