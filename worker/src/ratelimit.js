// Fixed-window rate limiting backed by D1 (strongly consistent: every read and write goes to the primary).
// The previous KV limiter was eventually consistent and could miss repeated failures (pen test 2026-11-01, #1).
// Row key: sha256(`${scope}|${id}`) — ids (IP + account) are hashed, never stored raw. Old windows are
// removed by the daily cron (purge -> purgeRateLimits).
import { sha256Hex } from './crypto.js';

export const LIMITS = {
  login: { max: 5, windowSec: 900 },    // 5 failures / 15 min per IP+account (password, TOTP, step-up, bootstrap)
  optout: { max: 30, windowSec: 3600 }, // 30 writes / hour per user
  oauth_start: { max: 30, windowSec: 600 }, // OAuth flow starts / 10 min per IP
  oauth_cb: { max: 30, windowSec: 600 },    // OAuth callbacks / 10 min per IP
  handoff: { max: 30, windowSec: 600 },     // handoff code redemptions / 10 min per IP
};

const nowSec = () => Math.floor(Date.now() / 1000);
const win = (scope, at) => {
  const w = LIMITS[scope].windowSec;
  const start = Math.floor(at / w) * w;
  return { start, end: start + w };
};
const key = (scope, id) => sha256Hex(`${scope}|${id}`);

// Returns 0 when allowed, otherwise the seconds until the window resets (use as Retry-After).
export async function isLimited(env, scope, id, at = nowSec()) {
  const { start, end } = win(scope, at);
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key = ?1 AND window_start = ?2')
    .bind(await key(scope, id), start).first();
  return row && row.count >= LIMITS[scope].max ? Math.max(1, end - at) : 0;
}

// Atomically increments the counter for the current window and returns the new count.
export async function hit(env, scope, id, at = nowSec()) {
  const { start, end } = win(scope, at);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count, expires_at) VALUES (?1, ?2, 1, ?3)
     ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`,
  ).bind(await key(scope, id), start, end).first();
  return row.count;
}

export const purgeRateLimitsStmt = (env, at) => env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?1').bind(at);

// Uniform 429 body per scope family, with Retry-After.
export const retryHeaders = (secs, extra = {}) => ({ 'Retry-After': String(secs), ...extra });

export const clientIp = (req) => req.headers.get('CF-Connecting-IP') || 'unknown';
