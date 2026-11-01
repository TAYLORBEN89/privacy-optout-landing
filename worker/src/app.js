// D1-backed auth + opt-out API. Every D1 query uses prepare().bind(); never build SQL from strings.
import { authenticator } from 'otplib';
import {
  randomToken, sha256Hex, timingSafeEqual, verifyPassword, dummyVerify, encryptStr, decryptStr,
  encryptPii, decryptPii, hashPassword,
} from './crypto.js';
import { reserve, refund, clientIp, retryHeaders, purgeRateLimitsStmt } from './ratelimit.js';

const COOKIE = '__Host-sid';
const STEP = 30;
authenticator.options = { step: STEP, window: 1 };

const now = () => Math.floor(Date.now() / 1000);
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
export const cfg = (env) => ({
  idle: num(env.SESSION_IDLE_SECONDS, 43200),
  absolute: num(env.SESSION_ABSOLUTE_SECONDS, 604800),
  preauth: num(env.PREAUTH_SECONDS, 300),
});

export const allowedOrigins = (env) => (env.ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);

export function corsHeaders(env, origin) {
  // Exact-match echo only; never '*', never a fallback origin. Unknown/missing Origin gets no ACAO header.
  const h = { Vary: 'Origin' };
  if (!(origin && allowedOrigins(env).includes(origin))) return h;
  return {
    ...h,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(ctx, body, status = 200, extra = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(ctx.env, ctx.origin) });
  for (const [k, v] of Object.entries(extra)) headers.append(k, v);
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}
const INVALID = (ctx) => json(ctx, { error: 'invalid credentials' }, 401);
const UNAUTH = (ctx) => json(ctx, { error: 'unauthorized' }, 401);

// SESSION_COOKIE_SAMESITE: "Strict" (default) when dashboard and API share a site (droptexas.com + api.droptexas.com).
// "None" only for the cross-site pages.dev/workers.dev setup; then Partitioned (CHIPS) is added.
// Either way CSRF protection also comes from the per-session X-CSRF-Token + strict Origin allowlist.
// "Lax" (production, same-origin plan): required because the OAuth callback is a top-level cross-site navigation;
// a Strict cookie would not be sent on the redirect back from the provider.
const cookieAttrs = (env) => {
  const v = String(env.SESSION_COOKIE_SAMESITE || 'Strict').toLowerCase();
  if (v === 'none') return 'Path=/; HttpOnly; Secure; SameSite=None; Partitioned';
  if (v === 'lax') return 'Path=/; HttpOnly; Secure; SameSite=Lax';
  return 'Path=/; HttpOnly; Secure; SameSite=Strict';
};
export const setCookie = (env, token, maxAge) => `${COOKIE}=${token}; ${cookieAttrs(env)}; Max-Age=${maxAge}`;
export const clearCookie = (env) => `${COOKIE}=; ${cookieAttrs(env)}; Max-Age=0`;
function readCookie(req) {
  const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)__Host-sid=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Audit context: client IP + User-Agent (<=512 chars) go ONLY into D1 audit_log, never into console/Workers Logs.
export const auditMeta = (req) => {
  const ip = req?.headers?.get('CF-Connecting-IP') || null;
  const ua = (req?.headers?.get('User-Agent') || '').slice(0, 512) || null;
  return [ip, ua];
};
// `ctx` is a request context { env, req }; a bare env is accepted (no request -> ip/ua NULL, e.g. cron).
// opts.ua=false stores a NULL User-Agent (used for unauthenticated auth.fail rows; the IP is kept for rate-limit forensics).
export async function audit(ctx, userId, action, target = null, opts = {}) {
  const env = ctx.env ?? ctx;
  const [ip, uaRaw] = auditMeta(ctx.req);
  const ua = opts.ua === false ? null : uaRaw;
  await env.DB.prepare('INSERT INTO audit_log (user_id, action, target, at, ip, user_agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(userId, action, target, now(), ip, ua).run();
}

export async function readJson(req) {
  try {
    const t = await req.text();
    if (t.length > 16384) return null;
    const v = JSON.parse(t);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

// ---------- sessions ----------
export async function createSession(env, userId, mfa, { absoluteExp, rotatedFrom, authMethod = 'password', steppedUpAt = null } = {}) {
  const c = cfg(env);
  const token = randomToken(32);
  const csrf = randomToken(32);
  const t = now();
  const exp = absoluteExp ?? t + c.absolute;
  // Session INSERT and the last_active_at bump are one D1 batch (one transaction): both succeed or neither does.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sessions (id_hash, user_id, stage, mfa, csrf, created_at, last_seen_at, expires_at, rotated_from, auth_method, stepped_up_at)
       VALUES (?1, ?2, 'session', ?3, ?4, ?5, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(await sha256Hex(token), userId, mfa ? 1 : 0, csrf, t, exp, rotatedFrom ?? null, authMethod, steppedUpAt),
    env.DB.prepare('UPDATE users SET last_active_at = ?1, inactivity_warned_at = NULL WHERE id = ?2').bind(t, userId),
  ]);
  return { token, csrf, maxAge: Math.min(c.idle, exp - t) };
}

export const revoke = (env, idHash) => env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE id_hash = ?1').bind(idHash).run();

// Returns { session, idHash } or null. Detects reuse of a rotated (revoked) token and kills all user sessions.
export async function loadSession(ctx) {
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
      await audit(ctx, s.user_id, 'session.reuse_detected');
    }
    return null;
  }
  if (t >= s.expires_at || t - s.last_seen_at >= cfg(ctx.env).idle) { await revoke(ctx.env, idHash); return null; }
  await ctx.env.DB.prepare('UPDATE sessions SET last_seen_at = ?1 WHERE id_hash = ?2').bind(t, idHash).run();
  return { session: s, idHash };
}

export async function rotate(ctx, cur, mfa) {
  await revoke(ctx.env, cur.idHash);
  return createSession(ctx.env, cur.session.user_id, mfa, {
    absoluteExp: cur.session.expires_at, rotatedFrom: cur.idHash,
    authMethod: cur.session.auth_method || 'password', steppedUpAt: cur.session.stepped_up_at ?? null,
  });
}

export const sessionResponse = (ctx, s, body, status = 200) =>
  json(ctx, { ...body, csrf_token: s.csrf }, status, { 'Set-Cookie': setCookie(ctx.env, s.token, s.maxAge) });

// Step-up: re-authentication within the last 10 minutes (social re-auth, password+TOTP, or a fresh login).
export const STEP_UP_SECONDS = 600;
export const isSteppedUp = (s) => !!s.stepped_up_at && now() - s.stepped_up_at <= STEP_UP_SECONDS;
const STEP_UP_REQUIRED = (ctx) => json(ctx, { error: 'step_up_required' }, 403);

// ---------- handlers ----------
async function login(ctx) {
  const body = await readJson(ctx.req);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  const password = typeof body?.password === 'string' ? body.password.slice(0, 1024) : '';
  const rlId = `${clientIp(ctx.req)}|${email}`;
  const rlRes = await reserve(ctx.env, 'login', rlId);
  if (rlRes.limited) return json(ctx, { error: 'too many attempts' }, 429, retryHeaders(rlRes.limited));

  const user = email
    ? await ctx.env.DB.prepare('SELECT id, pw_hash, totp_enabled FROM users WHERE email = ?1').bind(email).first()
    : null;
  // Social-only users have the sentinel pw_hash '!' and can never pass password login.
  const ok = user && user.pw_hash !== '!' ? await verifyPassword(password, user.pw_hash) : await dummyVerify(password);
  if (!ok || !password) return INVALID(ctx);
  await refund(ctx.env, rlRes); // success: only failures stay counted

  if (!user.totp_enabled) {
    // No MFA yet: limited session that may only enroll TOTP / logout / read /me.
    const s = await createSession(ctx.env, user.id, false);
    await audit(ctx, user.id, 'login.password_only');
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
export async function checkTotp(secret, code, lastStep) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const delta = authenticator.checkDelta(String(code), secret);
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / STEP) + delta;
  if (lastStep != null && step <= lastStep) return null;
  return step;
}

// Atomic compare-and-set on totp_last_step so two concurrent requests can't both use the same step.
export async function claimStep(env, userId, step) {
  const r = await env.DB.prepare(
    'UPDATE users SET totp_last_step = ?1 WHERE id = ?2 AND (totp_last_step IS NULL OR totp_last_step < ?1)',
  ).bind(step, userId).run();
  return r.meta.changes === 1;
}

// ---------- backup codes ----------
const BACKUP_COUNT = 10;
const B32 = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 symbols, no 0/1/l/o
function newBackupCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => B32[b & 31]); // 16 chars x 5 bits = 80 bits
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12).join('')}`;
}
const normBackup = (c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const isBackupShape = (c) => normBackup(c).length === 16;

async function issueBackupCodes(env, userId) {
  const codes = Array.from({ length: BACKUP_COUNT }, newBackupCode);
  const t = now();
  const stmts = [env.DB.prepare('DELETE FROM backup_codes WHERE user_id = ?1').bind(userId)];
  for (const c of codes) {
    stmts.push(env.DB.prepare('INSERT INTO backup_codes (user_id, code_hash, created_at) VALUES (?1, ?2, ?3)')
      .bind(userId, await sha256Hex(normBackup(c)), t));
  }
  await env.DB.batch(stmts);
  return codes; // plaintext returned once; only hashes are stored
}

// Atomically consume one unused backup code. Returns true on success.
export async function useBackupCode(env, userId, code) {
  const r = await env.DB.prepare('UPDATE backup_codes SET used_at = ?1 WHERE user_id = ?2 AND code_hash = ?3 AND used_at IS NULL')
    .bind(now(), userId, await sha256Hex(normBackup(code))).run();
  return r.meta.changes === 1;
}

async function regenerateBackupCodes(ctx, cur) {
  if (!cur.session.mfa) return json(ctx, { error: 'mfa required' }, 403);
  const rlId = `${clientIp(ctx.req)}|backup-regen|${cur.session.user_id}`;
  const rlRes = await reserve(ctx.env, 'login', rlId);
  if (rlRes.limited) return json(ctx, { error: 'too many attempts' }, 429, retryHeaders(rlRes.limited));
  const codes = await issueBackupCodes(ctx.env, cur.session.user_id);
  await audit(ctx, cur.session.user_id, 'backup_codes.regenerated');
  return json(ctx, { backup_codes: codes });
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
  const rlRes = await reserve(ctx.env, 'login', rlId);
  if (rlRes.limited) return json(ctx, { error: 'too many attempts' }, 429, retryHeaders(rlRes.limited));

  let ok;
  let method = 'totp';
  if (isBackupShape(body.code)) {
    method = 'backup_code';
    ok = await useBackupCode(ctx.env, p.user_id, body.code);
  } else {
    const secret = await decryptStr(ctx.env, p.totp_secret_enc);
    const step = await checkTotp(secret, body.code, p.totp_last_step);
    ok = step !== null && (await claimStep(ctx.env, p.user_id, step));
  }
  if (!ok) {
    await audit(ctx, p.user_id, 'totp.fail');
    return INVALID(ctx);
  }
  await refund(ctx.env, rlRes);
  await revoke(ctx.env, preHash); // pre-auth token is single-use
  const s = await createSession(ctx.env, p.user_id, true, { steppedUpAt: now() }); // fresh password+2FA = step-up
  await audit(ctx, p.user_id, method === 'backup_code' ? 'login.backup_code' : 'login.mfa');
  return sessionResponse(ctx, s, { ok: true });
}

async function totpEnroll(ctx, cur) {
  const u = await ctx.env.DB.prepare('SELECT email, totp_enabled FROM users WHERE id = ?1').bind(cur.session.user_id).first();
  // Re-enrolling an already-enabled factor requires an MFA session.
  if (u.totp_enabled && !cur.session.mfa) return UNAUTH(ctx);
  const secret = authenticator.generateSecret(20);
  await ctx.env.DB.prepare('UPDATE users SET totp_pending_enc = ?1 WHERE id = ?2')
    .bind(await encryptStr(ctx.env, secret), cur.session.user_id).run();
  await audit(ctx, cur.session.user_id, 'totp.enroll_start');
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
  await audit(ctx, cur.session.user_id, 'totp.enabled');
  const backupCodes = await issueBackupCodes(ctx.env, cur.session.user_id); // shown once
  const s = await rotate(ctx, cur, true); // privilege change -> new token
  return sessionResponse(ctx, s, { ok: true, totp_enabled: true, backup_codes: backupCodes });
}

async function refresh(ctx, cur) {
  const s = await rotate(ctx, cur, !!cur.session.mfa);
  return sessionResponse(ctx, s, { ok: true });
}

async function logout(ctx, cur) {
  await revoke(ctx.env, cur.idHash);
  await audit(ctx, cur.session.user_id, 'logout');
  return json(ctx, { ok: true }, 200, { 'Set-Cookie': clearCookie(ctx.env) });
}

async function me(ctx, cur) {
  const u = await ctx.env.DB.prepare('SELECT id, email, totp_enabled FROM users WHERE id = ?1').bind(cur.session.user_id).first();
  return json(ctx, { ...u, mfa: !!cur.session.mfa, csrf_token: cur.session.csrf });
}

const STATUSES = ['queued', 'submitted', 'in_progress', 'pending', 'confirmed', 'denied', 'reverify'];

async function listOptouts(ctx, cur) {
  const r = await ctx.env.DB.prepare('SELECT * FROM optout_requests WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 500')
    .bind(cur.session.user_id).all();
  return json(ctx, r.results);
}

async function createOptout(ctx, cur) {
  const uid = cur.session.user_id;
  const rlRes = await reserve(ctx.env, 'optout', uid);
  if (rlRes.limited) return json(ctx, { error: 'too many requests' }, 429, retryHeaders(rlRes.limited));
  const b = await readJson(ctx.req);
  if (!b) return json(ctx, { error: 'bad request' }, 400);
  const status = b.status ?? 'queued';
  const kind = b.kind ?? 'optout';
  if (!STATUSES.includes(status) || !['optout', 'tx'].includes(kind)) return json(ctx, { error: 'bad request' }, 400);
  const brokerId = typeof b.broker_id === 'string' ? b.broker_id.slice(0, 64) : null;
  if (brokerId && !(await ctx.env.DB.prepare('SELECT 1 FROM brokers WHERE id = ?1').bind(brokerId).first())) {
    return json(ctx, { error: 'unknown broker' }, 400);
  }
  const id = crypto.randomUUID();
  const t = now();
  await ctx.env.DB.prepare(
    `INSERT INTO optout_requests (id, user_id, broker_id, status, notes, created_at, updated_at, kind, finished_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7, ?8)`,
  ).bind(id, uid, brokerId, status,
    typeof b.notes === 'string' ? b.notes.slice(0, 2000) : null, t, kind, FINISHED.has(status) ? t : null).run();
  await audit(ctx, uid, 'optout.create', id);
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
    ctx.env.DB.prepare("UPDATE optout_requests SET status = 'confirmed', confirmed_at = ?1, finished_at = ?1, updated_at = ?1 WHERE id = ?2").bind(t, reqId),
  ]);
  await audit(ctx, cur.session.user_id, 'confirmation.add', reqId);
  return json(ctx, { ok: true }, 201);
}

// Allowed status transitions (same value = no-op allowed).
export const TRANSITIONS = {
  queued: ['submitted', 'in_progress'],
  submitted: ['in_progress', 'pending', 'confirmed', 'denied'],
  in_progress: ['submitted', 'pending', 'confirmed', 'denied'],
  pending: ['submitted', 'in_progress', 'confirmed', 'denied'],
  confirmed: ['reverify'],
  denied: ['submitted', 'in_progress', 'pending'],
  reverify: ['queued', 'submitted', 'in_progress', 'confirmed'],
};
// "Finished" = a final response was received (confirmed, incl. TX no_record; or denied, incl. AG complaint filed).
// finished_at starts the 24-month (optout) / 3-year (tx) retention clocks; it is cleared if the record is reopened.
const FINISHED = new Set(['confirmed', 'denied']);
const ID_RE = /^[0-9a-f-]{36}$/;
const optNum = (v) => (v === null ? null : Number.isInteger(v) && v >= 0 ? v : undefined);

async function patchOptout(ctx, cur, id) {
  const uid = cur.session.user_id;
  const rlRes = await reserve(ctx.env, 'optout', uid);
  if (rlRes.limited) return json(ctx, { error: 'too many requests' }, 429, retryHeaders(rlRes.limited));
  const b = await readJson(ctx.req);
  if (!b) return json(ctx, { error: 'bad request' }, 400);
  const row = await ctx.env.DB.prepare('SELECT * FROM optout_requests WHERE id = ?1 AND user_id = ?2').bind(id, uid).first();
  if (!row) return json(ctx, { error: 'not found' }, 404);

  let status = row.status;
  if (b.status !== undefined && b.status !== row.status) {
    if (!STATUSES.includes(b.status) || !TRANSITIONS[row.status].includes(b.status)) {
      return json(ctx, { error: 'invalid status transition', from: row.status, allowed: TRANSITIONS[row.status] }, 409);
    }
    status = b.status;
  }
  const notes = b.notes === undefined ? row.notes : typeof b.notes === 'string' ? b.notes.slice(0, 2000) : null;
  const subStatus = b.sub_status === undefined ? row.sub_status : typeof b.sub_status === 'string' ? b.sub_status.slice(0, 32) : null;
  const nextReverify = b.next_reverify === undefined ? row.next_reverify : optNum(b.next_reverify);
  const deadline = b.deadline === undefined ? row.deadline : optNum(b.deadline);
  if (nextReverify === undefined || deadline === undefined) return json(ctx, { error: 'bad request' }, 400);

  const t = now();
  const changed = status !== row.status;
  const submittedAt = changed && status === 'submitted' ? t : row.submitted_at;
  const confirmedAt = changed && status === 'confirmed' ? t : row.confirmed_at;
  const finishedAt = changed ? (FINISHED.has(status) ? t : null) : row.finished_at;
  const stmts = [ctx.env.DB.prepare(
    `UPDATE optout_requests SET status = ?1, notes = ?2, sub_status = ?3, next_reverify = ?4, deadline = ?5,
       submitted_at = ?6, confirmed_at = ?7, finished_at = ?8, updated_at = ?9 WHERE id = ?10 AND user_id = ?11`,
  ).bind(status, notes, subStatus, nextReverify, deadline, submittedAt, confirmedAt, finishedAt, t, id, uid),
  ctx.env.DB.prepare('INSERT INTO audit_log (user_id, action, target, at, ip, user_agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(uid, changed ? `optout.status:${row.status}->${status}` : 'optout.update', id, t, ...auditMeta(ctx.req))];
  if (b.pii !== undefined) {
    if (b.pii === null) {
      stmts.push(ctx.env.DB.prepare('DELETE FROM pii_payloads WHERE request_id = ?1').bind(id));
    } else {
      const plain = JSON.stringify(b.pii);
      if (plain.length > 8192) return json(ctx, { error: 'pii too large' }, 413);
      const { blob, version } = await encryptPii(ctx.env, plain, `pii:${id}`);
      const hardMax = num(ctx.env.PII_HARD_MAX_DAYS, 90) * 86400;
      stmts.push(ctx.env.DB.prepare(
        `INSERT INTO pii_payloads (request_id, payload_enc, key_version, created_at, purge_after) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(request_id) DO UPDATE SET payload_enc = excluded.payload_enc, key_version = excluded.key_version`,
      ).bind(id, blob, version, t, t + hardMax)); // hard max counts from the first write; updates don't extend it
    }
  }
  await ctx.env.DB.batch(stmts);
  const out = await ctx.env.DB.prepare('SELECT * FROM optout_requests WHERE id = ?1').bind(id).first();
  return json(ctx, out);
}

async function getOptoutPii(ctx, cur, id) {
  const r = await ctx.env.DB.prepare(
    'SELECT p.payload_enc, p.key_version, p.purge_after FROM pii_payloads p JOIN optout_requests o ON o.id = p.request_id WHERE p.request_id = ?1 AND o.user_id = ?2',
  ).bind(id, cur.session.user_id).first();
  if (!r) return json(ctx, { error: 'not found' }, 404);
  const pii = JSON.parse(await decryptPii(ctx.env, r.payload_enc, r.key_version, `pii:${id}`));
  return json(ctx, { pii, purge_after: r.purge_after });
}

async function listBrokers(ctx) {
  const r = await ctx.env.DB.prepare('SELECT id, name, url, method, category, reverify_days FROM brokers ORDER BY name LIMIT 1000').all();
  return json(ctx, r.results);
}

async function getProfile(ctx, cur) {
  const uid = cur.session.user_id;
  const r = await ctx.env.DB.prepare('SELECT payload_enc, key_version, updated_at FROM profiles WHERE user_id = ?1').bind(uid).first();
  if (!r) return json(ctx, {});
  return json(ctx, JSON.parse(await decryptPii(ctx.env, r.payload_enc, r.key_version, `profile:${uid}`)));
}

async function putProfile(ctx, cur) {
  const uid = cur.session.user_id;
  const b = await readJson(ctx.req);
  if (!b) return json(ctx, { error: 'bad request' }, 400);
  const plain = JSON.stringify(b);
  if (plain.length > 8192) return json(ctx, { error: 'profile too large' }, 413);
  const { blob, version } = await encryptPii(ctx.env, plain, `profile:${uid}`);
  const t = now();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO profiles (user_id, payload_enc, key_version, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id) DO UPDATE SET payload_enc = excluded.payload_enc, key_version = excluded.key_version, updated_at = excluded.updated_at`,
    ).bind(uid, blob, version, t),
    ctx.env.DB.prepare('INSERT INTO audit_log (user_id, action, target, at, ip, user_agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(uid, 'profile.update', null, t, ...auditMeta(ctx.req)),
  ]);
  return json(ctx, b);
}

// ---------- first-user bootstrap ----------
// POST /admin/bootstrap  Authorization: Bearer <ADMIN_BOOTSTRAP_TOKEN>  {email, password}
// Only succeeds while the users table is empty (atomic INSERT ... WHERE NOT EXISTS), so it self-disables.
async function bootstrap(ctx) {
  const rlId = `${clientIp(ctx.req)}|bootstrap`;
  const rlRes = await reserve(ctx.env, 'login', rlId);
  if (rlRes.limited) return json(ctx, { error: 'too many attempts' }, 429, retryHeaders(rlRes.limited));
  const h = ctx.req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const expected = ctx.env.ADMIN_BOOTSTRAP_TOKEN || '';
  if (expected.length < 32 || !timingSafeEqual(token, expected)) return json(ctx, { error: 'not found' }, 404);
  await refund(ctx.env, rlRes);
  if (await ctx.env.DB.prepare('SELECT 1 FROM users LIMIT 1').first()) return json(ctx, { error: 'not found' }, 404);
  const b = await readJson(ctx.req);
  const email = typeof b?.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b?.password === 'string' ? b.password : '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return json(ctx, { error: 'invalid email' }, 400);
  if (password.length < 12 || password.length > 1024) return json(ctx, { error: 'password must be 12-1024 characters' }, 400);
  const id = crypto.randomUUID();
  const t = now();
  const r = await ctx.env.DB.prepare(
    'INSERT INTO users (id, email, pw_hash, created_at, last_active_at) SELECT ?1, ?2, ?3, ?4, ?4 WHERE NOT EXISTS (SELECT 1 FROM users)',
  ).bind(id, email, await hashPassword(password), t).run();
  if (r.meta.changes !== 1) return json(ctx, { error: 'not found' }, 404);
  await audit(ctx, id, 'user.bootstrap');
  return json(ctx, { ok: true, user_id: id, next: 'log in, then enroll TOTP' }, 201);
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
  if (m === 'POST' && path === '/admin/bootstrap') return bootstrap(ctx);

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
  if (m === 'POST' && path === '/auth/backup-codes/regenerate') return regenerateBackupCodes(ctx, cur);

  // Everything below requires a TOTP-verified session.
  if (!cur.session.mfa) return json(ctx, { error: 'mfa required' }, 403);
  if (m === 'GET' && path === '/optouts') return listOptouts(ctx, cur);
  if (m === 'POST' && path === '/optouts') return createOptout(ctx, cur);
  const cm = path.match(/^\/optouts\/([0-9a-f-]{36})\/confirmations$/);
  if (cm && m === 'POST') return addConfirmation(ctx, cur, cm[1]);
  if (m === 'GET' && path === '/brokers') return listBrokers(ctx);
  // Identifier/PII reads and writes on the legacy routes require step-up (kept for the dashboard, gated not removed).
  if (m === 'GET' && path === '/profile') return isSteppedUp(cur.session) ? getProfile(ctx, cur) : STEP_UP_REQUIRED(ctx);
  if (m === 'PUT' && path === '/profile') return isSteppedUp(cur.session) ? putProfile(ctx, cur) : STEP_UP_REQUIRED(ctx);
  const om = path.match(/^\/optouts\/([^/]+)(\/pii)?$/);
  if (om && ID_RE.test(om[1])) {
    if (!om[2] && m === 'PATCH') return patchOptout(ctx, cur, om[1]);
    if (om[2] && m === 'GET') return isSteppedUp(cur.session) ? getOptoutPii(ctx, cur, om[1]) : STEP_UP_REQUIRED(ctx);
  }
  return json(ctx, { error: 'not found' }, 404);
}

export const isAppPath = (pathname) => /^\/(auth|me|optouts|brokers|profile|admin|api)(\/|$)/.test(pathname);

// ---------- scheduled purge ----------
// Retention (env vars, days): PII_RETENTION_DAYS (after confirmation, 30), PII_HARD_MAX_DAYS (90, enforced via purge_after),
// SESSION_PURGE_DAYS (after expiry/revocation, 7), FINISHED_RECORD_RETENTION_DAYS (optout kind, 730 = 24 months),
// TX_RECORD_RETENTION_DAYS (Texas kind, 1095 = 3 years). Record retention counts from finished_at (confirmed/denied).
// audit_log is NOT purged here; it has its own append-only expiry job (expireAudit) below.
export function retention(env) {
  return {
    piiDays: num(env.PII_RETENTION_DAYS, 30),
    sessionDays: num(env.SESSION_PURGE_DAYS, 7),
    finishedDays: num(env.FINISHED_RECORD_RETENTION_DAYS, 730),
    txDays: num(env.TX_RECORD_RETENTION_DAYS, 1095),
  };
}

export async function purge(env, at = now()) {
  const day = 86400;
  const r = retention(env);
  const res = await env.DB.batch([
    env.DB.prepare('DELETE FROM pii_payloads WHERE purge_after < ?1').bind(at),
    env.DB.prepare(
      'DELETE FROM pii_payloads WHERE request_id IN (SELECT id FROM optout_requests WHERE confirmed_at IS NOT NULL AND confirmed_at < ?1)',
    ).bind(at - r.piiDays * day),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1 OR (revoked = 1 AND last_seen_at < ?1)').bind(at - r.sessionDays * day),
    env.DB.prepare('DELETE FROM oauth_states_used WHERE used_at < ?1').bind(at - day), // state cookies live 10 min
    env.DB.prepare('DELETE FROM auth_handoffs WHERE expires_at < ?1').bind(at),         // handoff codes live 60 s; drop once expired
    // Cascades to confirmations and pii_payloads.
    env.DB.prepare("DELETE FROM optout_requests WHERE kind = 'optout' AND finished_at IS NOT NULL AND finished_at < ?1").bind(at - r.finishedDays * day),
    env.DB.prepare("DELETE FROM optout_requests WHERE kind = 'tx' AND finished_at IS NOT NULL AND finished_at < ?1").bind(at - r.txDays * day),
    purgeRateLimitsStmt(env, at), // all[7]: rate-limit windows that have ended (not reported)
  ]);
  const all = res.map((x) => x.meta.changes);
  const counts = [all[0], all[1], all[2], all[5], all[6]]; // all[3] oauth_states_used, all[4] auth_handoffs (not reported)
  console.log('purge', JSON.stringify({ pii_hard: counts[0], pii_after_confirm: counts[1], sessions: counts[2], optout_records: counts[3], tx_records: counts[4] }));
  return counts;
}

// ---------- audit_log expiry (separate scheduled job) ----------
// Same as PR #3. AUDIT_RETENTION_DAYS (min/default 365 = 12 months). The only path that deletes audit rows: opens the
// DB gate, deletes rows older than the cutoff, closes the gate and records the run in maintenance_log, all in one
// D1 batch (a single transaction), so the gate is never visible outside this job.
export async function expireAudit(env, at = now()) {
  const days = Math.max(365, num(env.AUDIT_RETENTION_DAYS, 365));
  const cutoff = at - days * 86400;
  const res = await env.DB.batch([
    env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('audit_expiry', ?1)").bind(cutoff),
    // Log first, counting the rows the DELETE below will remove. (changes() after the gate DELETE returned 1, the gate
    // row, not the audit rows.) Same transaction, so the count and the DELETE see identical data. maintenance_log is
    // append-only, so the count can't be patched in afterwards.
    env.DB.prepare(
      "INSERT INTO maintenance_log (job, ran_at, cutoff, deleted) VALUES ('audit_expiry', ?1, ?2, (SELECT COUNT(*) FROM audit_log WHERE at < ?2))",
    ).bind(at, cutoff),
    env.DB.prepare('DELETE FROM audit_log WHERE at < ?1').bind(cutoff),
    env.DB.prepare("DELETE FROM maintenance_gate WHERE name = 'audit_expiry'"),
  ]);
  const deleted = res[2].meta.changes;
  console.log('audit_expiry', JSON.stringify({ deleted }));
  return deleted;
}

// ---------- inactive accounts ----------
// INACTIVE_WARN_DAYS (700 ~ 23 months): send one warning email. INACTIVE_DELETE_DAYS (730 = 24 months): delete the
// account (cascades to sessions, opt-out records, PII, profile) but only if a warning went out at least
// INACTIVE_MIN_NOTICE_DAYS (14) earlier. Mail goes through the Cloudflare Email Service binding env.MAILER;
// if it is not configured, nobody is warned and therefore nobody is deleted.
// Deletion happens at the later of (last activity + delDays) and (warning + notice), so a late warning
// (backlog, mail outage, config change) still gets the full notice. The email states that real deadline.
export function inactivityDeadline(lastSeen, warnedAt, delDays, notice) {
  return Math.max(lastSeen + delDays * 86400, warnedAt + notice * 86400);
}
export function inactivityWarningText(lastSeen, at, delDays, notice) {
  const deadline = inactivityDeadline(lastSeen, at, delDays, notice);
  const daysLeft = Math.ceil((deadline - at) / 86400);
  const months = Math.max(1, Math.round((at - lastSeen) / 86400 / 30.44));
  const date = new Date(deadline * 1000).toISOString().slice(0, 10);
  return `You have not signed in to DropTexas for about ${months} months. If you do not sign in within ${daysLeft} days `
    + `(by ${date} UTC), your account and all saved opt-out records will be deleted permanently. Sign in to keep it.`;
}
export async function inactiveAccounts(env, at = now()) {
  const day = 86400;
  const warnDays = num(env.INACTIVE_WARN_DAYS, 700);
  const delDays = num(env.INACTIVE_DELETE_DAYS, 730);
  const notice = num(env.INACTIVE_MIN_NOTICE_DAYS, 14);
  let warned = 0;
  if (env.MAILER && env.MAIL_FROM) {
    const due = await env.DB.prepare(
      // LIMIT 100 per run: a backlog drains over later daily runs; notice is counted from each account's own warning.
      // Social-only accounts have a placeholder address (<id>@users.invalid); skip them until real-address mail exists.
      "SELECT id, email, COALESCE(last_active_at, created_at) AS last_seen FROM users WHERE COALESCE(last_active_at, created_at) < ?1 AND inactivity_warned_at IS NULL AND email NOT LIKE '%@users.invalid' LIMIT 100",
    ).bind(at - warnDays * day).all();
    for (const u of due.results) {
      try {
        await env.MAILER.send({
          from: env.MAIL_FROM,
          to: u.email,
          subject: 'Your DropTexas account will be deleted for inactivity',
          text: inactivityWarningText(u.last_seen, at, delDays, notice),
        });
      } catch { console.error('inactive_warn send failed'); continue; } // no address/PII in logs
      await env.DB.prepare('UPDATE users SET inactivity_warned_at = ?1 WHERE id = ?2 AND inactivity_warned_at IS NULL').bind(at, u.id).run();
      warned++;
    }
  }
  const del = await env.DB.prepare(
    'DELETE FROM users WHERE COALESCE(last_active_at, created_at) < ?1 AND inactivity_warned_at IS NOT NULL AND inactivity_warned_at <= ?2',
  ).bind(at - delDays * day, at - notice * day).run();
  console.log('inactive_accounts', JSON.stringify({ warned, deleted: del.meta.changes }));
  return { warned, deleted: del.meta.changes };
}
