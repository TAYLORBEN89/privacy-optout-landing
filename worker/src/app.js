// D1-backed auth + opt-out API. Every D1 query uses prepare().bind(); never build SQL from strings.
import { authenticator } from 'otplib';
import {
  randomToken, sha256Hex, timingSafeEqual, verifyPassword, dummyVerify, encryptStr, decryptStr,
} from './crypto.js';
import { isLimited, hit, clientIp } from './ratelimit.js';

const COOKIE = '__Host-sid';
const STEP = 30;
authenticator.options = { step: STEP, window: 1 };

const now = () => Math.floor(Date.now() / 1000);
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const cfg = (env) => ({
  idle: num(env.SESSION_IDLE_SECONDS, 43200),
  absolute: num(env.SESSION_ABSOLUTE_SECONDS, 604800),
  preauth: num(env.PREAUTH_SECONDS, 300),
});

export const allowedOrigins = (env) => (env.ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);

export function corsHeaders(env, origin) {
  const list = allowedOrigins(env);
  return {
    'Access-Control-Allow-Origin': origin && list.includes(origin) ? origin : list[0] || '',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(ctx, body, status = 200, extra = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(ctx.env, ctx.origin) });
  for (const [k, v] of Object.entries(extra)) headers.append(k, v);
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}
const INVALID = (ctx) => json(ctx, { error: 'invalid credentials' }, 401);
const UNAUTH = (ctx) => json(ctx, { error: 'unauthorized' }, 401);

const setCookie = (token, maxAge) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
function readCookie(req) {
  const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)__Host-sid=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function audit(env, userId, action, target = null) {
  await env.DB.prepare('INSERT INTO audit_log (user_id, action, target, at) VALUES (?1, ?2, ?3, ?4)')
    .bind(userId, action, target, now()).run();
}

async function readJson(req) {
  try {
    const t = await req.text();
    if (t.length > 16384) return null;
    const v = JSON.parse(t);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

// ---------- sessions ----------
async function createSession(env, userId, mfa, { absoluteExp, rotatedFrom } = {}) {
  const c = cfg(env);
  const token = randomToken(32);
  const csrf = randomToken(32);
  const t = now();
  const exp = absoluteExp ?? t + c.absolute;
  await env.DB.prepare(
    `INSERT INTO sessions (id_hash, user_id, stage, mfa, csrf, created_at, last_seen_at, expires_at, rotated_from)
     VALUES (?1, ?2, 'session', ?3, ?4, ?5, ?5, ?6, ?7)`,
  ).bind(await sha256Hex(token), userId, mfa ? 1 : 0, csrf, t, exp, rotatedFrom ?? null).run();
  return { token, csrf, maxAge: Math.min(c.idle, exp - t) };
}

const revoke = (env, idHash) => env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE id_hash = ?1').bind(idHash).run();

// Returns { session, idHash } or null. Detects reuse of a rotated (revoked) token and kills all user sessions.
async function loadSession(ctx) {
  const token = readCookie(ctx.req);
  if (!token) return null;
  const idHash = await sha256Hex(token);
  const s = await ctx.env.DB.prepare("SELECT * FROM sessions WHERE id_hash = ?1 AND stage = 'session'").bind(idHash).first();
  if (!s) return null;
  const t = now();
  if (s.revoked) {
    const child = await ctx.env.DB.prepare('SELECT 1 FROM sessions WHERE rotated_from = ?1').bind(idHash).first();
    if (child) {
      await ctx.env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?1').bind(s.user_id).run();
      await audit(ctx.env, s.user_id, 'session.reuse_detected');
    }
    return null;
  }
  if (t >= s.expires_at || t - s.last_seen_at >= cfg(ctx.env).idle) { await revoke(ctx.env, idHash); return null; }
  await ctx.env.DB.prepare('UPDATE sessions SET last_seen_at = ?1 WHERE id_hash = ?2').bind(t, idHash).run();
  return { session: s, idHash };
}

async function rotate(ctx, cur, mfa) {
  await revoke(ctx.env, cur.idHash);
  return createSession(ctx.env, cur.session.user_id, mfa, { absoluteExp: cur.session.expires_at, rotatedFrom: cur.idHash });
}

const sessionResponse = (ctx, s, body, status = 200) =>
  json(ctx, { ...body, csrf_token: s.csrf }, status, { 'Set-Cookie': setCookie(s.token, s.maxAge) });

// ---------- handlers ----------
async function login(ctx) {
  const body = await readJson(ctx.req);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  const password = typeof body?.password === 'string' ? body.password.slice(0, 1024) : '';
  const rlId = `${clientIp(ctx.req)}|${email}`;
  if (await isLimited(ctx.env, 'login', rlId)) return json(ctx, { error: 'too many attempts' }, 429);

  const user = email
    ? await ctx.env.DB.prepare('SELECT id, pw_hash, totp_enabled FROM users WHERE email = ?1').bind(email).first()
    : null;
  const ok = user ? await verifyPassword(password, user.pw_hash) : await dummyVerify(password);
  if (!ok || !password) { await hit(ctx.env, 'login', rlId); return INVALID(ctx); }

  if (!user.totp_enabled) {
    // No MFA yet: limited session that may only enroll TOTP / logout / read /me.
    const s = await createSession(ctx.env, user.id, false);
    await audit(ctx.env, user.id, 'login.password_only');
    return sessionResponse(ctx, s, { mfa_required: false, totp_enrollment_required: true });
  }
  const pre = randomToken(32);
  const t = now();
  await ctx.env.DB.prepare(
    `INSERT INTO sessions (id_hash, user_id, stage, mfa, csrf, created_at, last_seen_at, expires_at)
     VALUES (?1, ?2, 'preauth', 0, NULL, ?3, ?3, ?4)`,
  ).bind(await sha256Hex(pre), user.id, t, t + cfg(ctx.env).preauth).run();
  return json(ctx, { mfa_required: true, preauth_token: pre, expires_in: cfg(ctx.env).preauth });
}

// Accept code only for a step newer than totp_last_step (replay protection). Returns matched step or null.
async function checkTotp(secret, code, lastStep) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const delta = authenticator.checkDelta(String(code), secret);
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / STEP) + delta;
  if (lastStep != null && step <= lastStep) return null;
  return step;
}

// Atomic compare-and-set on totp_last_step so two concurrent requests can't both use the same step.
async function claimStep(env, userId, step) {
  const r = await env.DB.prepare(
    'UPDATE users SET totp_last_step = ?1 WHERE id = ?2 AND (totp_last_step IS NULL OR totp_last_step < ?1)',
  ).bind(step, userId).run();
  return r.meta.changes === 1;
}

async function totpVerify(ctx) {
  const body = await readJson(ctx.req);
  const pre = typeof body?.preauth_token === 'string' ? body.preauth_token : '';
  if (!pre) return INVALID(ctx);
  const preHash = await sha256Hex(pre);
  const p = await ctx.env.DB.prepare(
    "SELECT s.user_id, s.expires_at, s.revoked, u.email, u.totp_secret_enc, u.totp_last_step FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?1 AND s.stage = 'preauth'",
  ).bind(preHash).first();
  if (!p || p.revoked || now() >= p.expires_at || !p.totp_secret_enc) return INVALID(ctx);
  const rlId = `${clientIp(ctx.req)}|${p.email}`;
  if (await isLimited(ctx.env, 'login', rlId)) return json(ctx, { error: 'too many attempts' }, 429);

  const secret = await decryptStr(ctx.env, p.totp_secret_enc);
  const step = await checkTotp(secret, body.code, p.totp_last_step);
  if (step === null || !(await claimStep(ctx.env, p.user_id, step))) {
    await hit(ctx.env, 'login', rlId);
    await audit(ctx.env, p.user_id, 'totp.fail');
    return INVALID(ctx);
  }
  await revoke(ctx.env, preHash); // pre-auth token is single-use
  const s = await createSession(ctx.env, p.user_id, true);
  await audit(ctx.env, p.user_id, 'login.mfa');
  return sessionResponse(ctx, s, { ok: true });
}

async function totpEnroll(ctx, cur) {
  const u = await ctx.env.DB.prepare('SELECT email, totp_enabled FROM users WHERE id = ?1').bind(cur.session.user_id).first();
  // Re-enrolling an already-enabled factor requires an MFA session.
  if (u.totp_enabled && !cur.session.mfa) return UNAUTH(ctx);
  const secret = authenticator.generateSecret(20);
  await ctx.env.DB.prepare('UPDATE users SET totp_pending_enc = ?1 WHERE id = ?2')
    .bind(await encryptStr(ctx.env, secret), cur.session.user_id).run();
  await audit(ctx.env, cur.session.user_id, 'totp.enroll_start');
  return json(ctx, { secret, otpauth_url: authenticator.keyuri(u.email, 'Privacy Dashboard', secret) });
}

async function totpConfirm(ctx, cur) {
  const body = await readJson(ctx.req);
  const u = await ctx.env.DB.prepare('SELECT totp_pending_enc, totp_last_step FROM users WHERE id = ?1').bind(cur.session.user_id).first();
  if (!u?.totp_pending_enc) return json(ctx, { error: 'no enrollment in progress' }, 400);
  const secret = await decryptStr(ctx.env, u.totp_pending_enc);
  const step = await checkTotp(secret, body?.code, u.totp_last_step);
  if (step === null || !(await claimStep(ctx.env, cur.session.user_id, step))) return json(ctx, { error: 'invalid code' }, 400);
  await ctx.env.DB.prepare(
    'UPDATE users SET totp_secret_enc = totp_pending_enc, totp_pending_enc = NULL, totp_enabled = 1 WHERE id = ?1',
  ).bind(cur.session.user_id).run();
  await audit(ctx.env, cur.session.user_id, 'totp.enabled');
  const s = await rotate(ctx, cur, true); // privilege change -> new token
  return sessionResponse(ctx, s, { ok: true, totp_enabled: true });
}

async function refresh(ctx, cur) {
  const s = await rotate(ctx, cur, !!cur.session.mfa);
  return sessionResponse(ctx, s, { ok: true });
}

async function logout(ctx, cur) {
  await revoke(ctx.env, cur.idHash);
  await audit(ctx.env, cur.session.user_id, 'logout');
  return json(ctx, { ok: true }, 200, { 'Set-Cookie': clearCookie() });
}

async function me(ctx, cur) {
  const u = await ctx.env.DB.prepare('SELECT id, email, totp_enabled FROM users WHERE id = ?1').bind(cur.session.user_id).first();
  return json(ctx, { ...u, mfa: !!cur.session.mfa, csrf_token: cur.session.csrf });
}

const STATUSES = ['queued', 'submitted', 'pending', 'confirmed', 'denied', 'reverify'];

async function listOptouts(ctx, cur) {
  const r = await ctx.env.DB.prepare('SELECT * FROM optout_requests WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 500')
    .bind(cur.session.user_id).all();
  return json(ctx, r.results);
}

async function createOptout(ctx, cur) {
  const uid = cur.session.user_id;
  if (await isLimited(ctx.env, 'optout', uid)) return json(ctx, { error: 'too many requests' }, 429);
  const b = await readJson(ctx.req);
  if (!b) return json(ctx, { error: 'bad request' }, 400);
  const status = b.status ?? 'queued';
  if (!STATUSES.includes(status)) return json(ctx, { error: 'bad request' }, 400);
  const brokerId = typeof b.broker_id === 'string' ? b.broker_id.slice(0, 64) : null;
  if (brokerId && !(await ctx.env.DB.prepare('SELECT 1 FROM brokers WHERE id = ?1').bind(brokerId).first())) {
    return json(ctx, { error: 'unknown broker' }, 400);
  }
  const id = crypto.randomUUID();
  const t = now();
  await ctx.env.DB.prepare(
    `INSERT INTO optout_requests (id, user_id, broker_id, status, notes, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
  ).bind(id, uid, brokerId, status,
    typeof b.notes === 'string' ? b.notes.slice(0, 2000) : null, t).run();
  await hit(ctx.env, 'optout', uid);
  await audit(ctx.env, uid, 'optout.create', id);
  return json(ctx, { id, status }, 201);
}

async function addConfirmation(ctx, cur, reqId) {
  const b = await readJson(ctx.req);
  const no = typeof b?.confirmation_no === 'string' ? b.confirmation_no.trim().slice(0, 200) : '';
  if (!no) return json(ctx, { error: 'bad request' }, 400);
  const own = await ctx.env.DB.prepare('SELECT 1 FROM optout_requests WHERE id = ?1 AND user_id = ?2').bind(reqId, cur.session.user_id).first();
  if (!own) return json(ctx, { error: 'not found' }, 404);
  const t = now();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('INSERT INTO confirmations (request_id, confirmation_no, channel, received_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(reqId, no, typeof b.channel === 'string' ? b.channel.slice(0, 32) : null, t),
    ctx.env.DB.prepare("UPDATE optout_requests SET status = 'confirmed', confirmed_at = ?1, updated_at = ?1 WHERE id = ?2").bind(t, reqId),
  ]);
  await audit(ctx.env, cur.session.user_id, 'confirmation.add', reqId);
  return json(ctx, { ok: true }, 201);
}

// ---------- router ----------
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function handleApp(req, env) {
  const origin = req.headers.get('Origin');
  const ctx = { req, env, origin };
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;

  // Origin check: state-changing routes REQUIRE an allowlisted Origin (missing Origin is rejected).
  if (STATE_CHANGING.has(m) && !(origin && allowedOrigins(env).includes(origin))) return json(ctx, { error: 'forbidden' }, 403);

  if (m === 'POST' && path === '/auth/login') return login(ctx);
  if (m === 'POST' && path === '/auth/totp/verify') return totpVerify(ctx);

  const cur = await loadSession(ctx);
  if (!cur) return UNAUTH(ctx);
  // CSRF: per-session token in X-CSRF-Token on every state-changing route.
  if (STATE_CHANGING.has(m) && !timingSafeEqual(req.headers.get('X-CSRF-Token') || '', cur.session.csrf || '')) {
    return json(ctx, { error: 'forbidden' }, 403);
  }

  if (m === 'POST' && path === '/auth/logout') return logout(ctx, cur);
  if (m === 'POST' && path === '/auth/refresh') return refresh(ctx, cur);
  if (m === 'POST' && path === '/auth/totp/enroll') return totpEnroll(ctx, cur);
  if (m === 'POST' && path === '/auth/totp/confirm') return totpConfirm(ctx, cur);
  if (m === 'GET' && path === '/me') return me(ctx, cur);

  // Everything below requires a TOTP-verified session.
  if (!cur.session.mfa) return json(ctx, { error: 'mfa required' }, 403);
  if (m === 'GET' && path === '/optouts') return listOptouts(ctx, cur);
  if (m === 'POST' && path === '/optouts') return createOptout(ctx, cur);
  const cm = path.match(/^\/optouts\/([0-9a-f-]{36})\/confirmations$/);
  if (cm && m === 'POST') return addConfirmation(ctx, cur, cm[1]);
  return json(ctx, { error: 'not found' }, 404);
}

export const isAppPath = (pathname) => /^\/(auth|me|optouts)(\/|$)/.test(pathname);

// ---------- scheduled purge ----------
export async function purge(env) {
  const t = now();
  const day = 86400;
  const piiDays = num(env.PII_RETENTION_DAYS, 30);
  const auditDays = num(env.AUDIT_RETENTION_DAYS, 180);
  await env.DB.batch([
    // PII: gone at purge_after (set to creation + PII_HARD_MAX_DAYS), or piiDays after confirmation, whichever first.
    env.DB.prepare('DELETE FROM pii_payloads WHERE purge_after < ?1').bind(t),
    env.DB.prepare(
      'DELETE FROM pii_payloads WHERE request_id IN (SELECT id FROM optout_requests WHERE confirmed_at IS NOT NULL AND confirmed_at < ?1)',
    ).bind(t - piiDays * day),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1 OR (revoked = 1 AND last_seen_at < ?1)').bind(t - 7 * day),
    env.DB.prepare('DELETE FROM audit_log WHERE at < ?1').bind(t - auditDays * day),
  ]);
}
