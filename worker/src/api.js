// Same-origin /api/* routes: social sign-in (Google, Apple, Microsoft), step-up, account area, and the opt-out gate.
// Every D1 query uses a literal SQL string with prepare().bind(). No PII or tokens in audit_log targets or logs.
import {
  json, readJson, audit, createSession, loadSession, revoke, setCookie, clearCookie, allowedOrigins, handleApp,
  checkTotp, claimStep,
} from './app.js';
import { sha256Hex, timingSafeEqual, verifyPassword, dummyVerify, encryptPii, decryptPii, decryptStr } from './crypto.js';
import { isLimited, hit, clientIp } from './ratelimit.js';
import {
  PROVIDERS, redirectUriFor, client, authorizationUrl, newFlowSecrets, exchange, verifyIdToken, IdTokenError,
  sealState, openState, oauthCookie, clearOauthCookie, readOauthCookie, safeReturnTo,
} from './oauth.js';
import { validateSignup } from './shared/signup.ts';

const now = () => Math.floor(Date.now() / 1000);
export const STEP_UP_SECONDS = 600; // step-up is valid for 10 minutes
const NO_PASSWORD = '!';            // sentinel pw_hash for social-only users; verifyPassword() never accepts it
const UNAUTH = (ctx) => json(ctx, { error: 'unauthorized' }, 401);
const FORBIDDEN = (ctx) => json(ctx, { error: 'forbidden' }, 403);
const STEP_UP_REQUIRED = (ctx) => json(ctx, { error: 'step_up_required' }, 403);
const isSteppedUp = (s) => !!s.stepped_up_at && now() - s.stepped_up_at <= STEP_UP_SECONDS;

const redirect = (location, cookies = []) => {
  const h = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const c of cookies) h.append('Set-Cookie', c);
  return new Response(null, { status: 303, headers: h });
};

// Password/TOTP routes reachable same-origin under /api (the fallback, non-social sign-in).
const LEGACY_AUTH_ALIASES = new Set([
  '/api/auth/login', '/api/auth/totp/verify', '/api/auth/totp/enroll', '/api/auth/totp/confirm',
  '/api/auth/refresh', '/api/auth/backup-codes/regenerate',
]);

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const isAppleCallback = (method, path) => method === 'POST' && path === '/api/auth/apple/callback';

// A usable session for the new API: social sessions, or password sessions that completed TOTP.
async function requireSession(ctx) {
  const cur = await loadSession(ctx);
  if (!cur) return null;
  if (cur.session.auth_method === 'password' && !cur.session.mfa) return { ...cur, limited: true };
  return cur;
}

// ---------- OAuth start ----------
async function oauthStart(ctx, provider, { intent = 'login', cur = null, returnTo }) {
  const ip = clientIp(ctx.req);
  if (await isLimited(ctx.env, 'oauth_start', ip)) return json(ctx, { error: 'too many requests' }, 429);
  await hit(ctx.env, 'oauth_start', ip);
  const redirectUri = redirectUriFor(ctx.env, provider, ctx.req.url);
  const c = redirectUri && client(ctx.env, provider, redirectUri);
  if (!c) return json(ctx, { error: 'provider not configured' }, 503);
  const f = newFlowSecrets();
  const sealed = await sealState(ctx.env, {
    p: provider, s: f.state, v: f.verifier, n: f.nonce, r: safeReturnTo(returnTo), i: intent,
    u: cur?.session.user_id ?? null, sh: cur?.idHash ?? null,
  });
  const url = authorizationUrl(c, provider, { ...f, reauth: intent !== 'login' });
  return { url: url.toString(), cookie: oauthCookie(provider, sealed) };
}

async function startLogin(ctx, provider) {
  const r = await oauthStart(ctx, provider, { returnTo: new URL(ctx.req.url).searchParams.get('return_to') });
  if (r instanceof Response) return r;
  const h = new Headers({ Location: r.url, 'Cache-Control': 'no-store' });
  h.append('Set-Cookie', r.cookie);
  return new Response(null, { status: 302, headers: h });
}

// ---------- OAuth callback ----------
async function callback(ctx, provider) {
  const ip = clientIp(ctx.req);
  const fail = async (reason, userId = null) => {
    await audit(ctx, userId, 'auth.fail', `${provider}:${reason}`); // reason is a fixed category, never provider text
    return redirect(`/start?auth_error=${reason}`, [clearOauthCookie()]);
  };
  if (await isLimited(ctx.env, 'oauth_cb', ip)) return json(ctx, { error: 'too many requests' }, 429);
  await hit(ctx.env, 'oauth_cb', ip);

  let params;
  if (provider === 'apple') {
    if (ctx.req.method !== 'POST') return fail('bad_request');
    const t = await ctx.req.text();
    if (t.length > 32768) return fail('bad_request');
    params = new URLSearchParams(t);
  } else {
    params = new URL(ctx.req.url).searchParams;
  }
  const st = await openState(ctx.env, readOauthCookie(ctx.req));
  if (!st || st.p !== provider || !timingSafeEqual(params.get('state') || '', st.s)) return fail('bad_state');
  const used = await ctx.env.DB.prepare('INSERT INTO oauth_states_used (state_hash, used_at) VALUES (?1, ?2) ON CONFLICT(state_hash) DO NOTHING')
    .bind(await sha256Hex(st.s), now()).run();
  if (used.meta.changes !== 1) return fail('state_reused');
  if (params.get('error')) return fail('provider_error');
  const code = params.get('code');
  if (!code) return fail('bad_request');

  const redirectUri = redirectUriFor(ctx.env, provider, ctx.req.url);
  const c = redirectUri && client(ctx.env, provider, redirectUri);
  if (!c) return fail('not_configured');
  let idToken;
  try { idToken = await exchange(c, provider, code, st.v); } catch { return fail('token_exchange'); }
  let ident;
  try { ident = await verifyIdToken(ctx.env, provider, idToken, st.n); } catch (e) { return fail(e instanceof IdTokenError ? e.reason : 'id_token'); }

  const t = now();
  const existing = await ctx.env.DB.prepare('SELECT id, user_id, email FROM user_identities WHERE provider = ?1 AND sub = ?2')
    .bind(provider, ident.sub).first();

  if (st.i === 'link' || st.i === 'stepup') {
    // Bound session from the sealed cookie (works for Apple's cross-site POST where the Lax sid cookie isn't sent).
    const s = st.sh && await ctx.env.DB.prepare("SELECT * FROM sessions WHERE id_hash = ?1 AND stage = 'session'").bind(st.sh).first();
    if (!s || s.revoked || t >= s.expires_at || s.user_id !== st.u) return fail('session_mismatch');
    if (st.i === 'stepup') {
      if (!existing || existing.user_id !== s.user_id) return fail('identity_mismatch', s.user_id);
      if (typeof ident.authTime === 'number' && t - ident.authTime > STEP_UP_SECONDS) return fail('stale_auth', s.user_id);
      await ctx.env.DB.prepare('UPDATE sessions SET stepped_up_at = ?1 WHERE id_hash = ?2').bind(t, st.sh).run();
      await audit(ctx, s.user_id, 'auth.step_up', provider);
      return redirect(st.r, [clearOauthCookie()]);
    }
    if (!isSteppedUp(s)) return fail('step_up_required', s.user_id);
    if (existing) return fail(existing.user_id === s.user_id ? 'already_linked' : 'identity_in_use', s.user_id);
    await insertIdentity(ctx.env, s.user_id, provider, ident, t);
    await audit(ctx, s.user_id, 'identity.link', provider);
    return redirect(st.r, [clearOauthCookie()]);
  }

  // intent=login. Identities are keyed ONLY on (provider, sub); a matching email never links accounts.
  let userId;
  if (existing) {
    userId = existing.user_id;
    // Apple sends the email only reliably on the first authorization: keep the stored one if none now.
    if (ident.email) {
      const { blob, version } = await encryptPii(ctx.env, ident.email, `identity:${provider}:${ident.sub}`);
      await ctx.env.DB.prepare('UPDATE user_identities SET last_login_at = ?1, email = ?2, email_key_version = ?3, email_verified = ?4, is_private_relay = ?5 WHERE id = ?6')
        .bind(t, blob, version, ident.emailVerified ? 1 : 0, ident.privateRelay ? 1 : 0, existing.id).run();
    } else {
      await ctx.env.DB.prepare('UPDATE user_identities SET last_login_at = ?1 WHERE id = ?2').bind(t, existing.id).run();
    }
    await audit(ctx, userId, 'login.social', provider);
  } else {
    userId = crypto.randomUUID();
    await ctx.env.DB.prepare('INSERT INTO users (id, email, pw_hash, created_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(userId, `${userId}@users.invalid`, NO_PASSWORD, t).run();
    await insertIdentity(ctx.env, userId, provider, ident, t);
    await audit(ctx, userId, 'user.create_social', provider);
    await audit(ctx, userId, 'login.social', provider);
  }
  // Session fixation: drop any session this browser already had.
  const prior = await loadSession(ctx);
  if (prior) await revoke(ctx.env, prior.idHash);
  const s = await createSession(ctx.env, userId, false, { authMethod: provider, steppedUpAt: t }); // fresh auth counts as step-up
  return redirect(st.r, [clearOauthCookie(), setCookie(ctx.env, s.token, s.maxAge)]);
}

async function insertIdentity(env, userId, provider, ident, t) {
  let blob = null; let version = null;
  if (ident.email) ({ blob, version } = await encryptPii(env, ident.email, `identity:${provider}:${ident.sub}`));
  await env.DB.prepare(
    `INSERT INTO user_identities (user_id, provider, sub, email, email_key_version, email_verified, is_private_relay, created_at, last_login_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
  ).bind(userId, provider, ident.sub, blob, version, ident.emailVerified ? 1 : 0, ident.privateRelay ? 1 : 0, t).run();
}

// ---------- me / logout ----------
async function loadUser(env, uid) {
  return env.DB.prepare('SELECT id, pw_hash, totp_enabled, created_at, display_name_enc, display_name_key_version FROM users WHERE id = ?1').bind(uid).first();
}
const displayName = async (env, u) => (u.display_name_enc ? decryptPii(env, u.display_name_enc, u.display_name_key_version, `display:${u.id}`) : null);
const listIdentities = (env, uid) => env.DB.prepare(
  'SELECT provider, sub, email, email_key_version, email_verified, is_private_relay, created_at, last_login_at FROM user_identities WHERE user_id = ?1 ORDER BY created_at',
).bind(uid).all().then((r) => r.results);
const publicIdentity = (i) => ({ provider: i.provider, email_verified: !!i.email_verified, is_private_relay: !!i.is_private_relay, linked_at: i.created_at, last_login_at: i.last_login_at });
const hasPassword = (u) => u.pw_hash !== NO_PASSWORD && !!u.totp_enabled; // password counts as a sign-in method only with TOTP

async function me(ctx, cur) {
  const u = await loadUser(ctx.env, cur.session.user_id);
  if (!u) return UNAUTH(ctx);
  const ids = await listIdentities(ctx.env, u.id);
  return json(ctx, {
    user: { id: u.id, display_name: await displayName(ctx.env, u), has_password: hasPassword(u), totp_enabled: !!u.totp_enabled, created_at: u.created_at },
    providers: ids.map(publicIdentity),
    auth_method: cur.session.auth_method, mfa: !!cur.session.mfa, limited: !!cur.limited,
    stepped_up_until: isSteppedUp(cur.session) ? cur.session.stepped_up_at + STEP_UP_SECONDS : null,
    csrf_token: cur.session.csrf,
  });
}

async function logout(ctx, cur) {
  await revoke(ctx.env, cur.idHash);
  await audit(ctx, cur.session.user_id, 'logout');
  return json(ctx, { ok: true }, 200, { 'Set-Cookie': clearCookie(ctx.env) });
}

// ---------- step-up ----------
async function stepUpPassword(ctx, cur) {
  const b = await readJson(ctx.req);
  const u = await ctx.env.DB.prepare('SELECT id, pw_hash, totp_enabled, totp_secret_enc, totp_last_step FROM users WHERE id = ?1').bind(cur.session.user_id).first();
  const rlId = `${clientIp(ctx.req)}|stepup|${cur.session.user_id}`;
  if (await isLimited(ctx.env, 'login', rlId)) return json(ctx, { error: 'too many attempts' }, 429);
  const password = typeof b?.password === 'string' ? b.password.slice(0, 1024) : '';
  let ok = false;
  if (u && u.pw_hash !== NO_PASSWORD && u.totp_enabled && password) {
    ok = await verifyPassword(password, u.pw_hash);
    if (ok) {
      const step = await checkTotp(await decryptStr(ctx.env, u.totp_secret_enc), b?.code, u.totp_last_step);
      ok = step !== null && (await claimStep(ctx.env, u.id, step));
    }
  } else { await dummyVerify(password); }
  if (!ok) {
    await hit(ctx.env, 'login', rlId);
    await audit(ctx, cur.session.user_id, 'auth.fail', 'password:step_up');
    return json(ctx, { error: 'invalid credentials' }, 401);
  }
  const t = now();
  await ctx.env.DB.prepare('UPDATE sessions SET stepped_up_at = ?1 WHERE id_hash = ?2').bind(t, cur.idHash).run();
  await audit(ctx, cur.session.user_id, 'auth.step_up', 'password');
  return json(ctx, { ok: true, stepped_up_until: t + STEP_UP_SECONDS });
}

// POST /api/auth/{provider}/stepup and /api/account/identities/{provider}/link -> {url}; the browser navigates there.
async function startBound(ctx, cur, provider, intent) {
  if (intent === 'stepup') {
    const has = await ctx.env.DB.prepare('SELECT 1 FROM user_identities WHERE user_id = ?1 AND provider = ?2').bind(cur.session.user_id, provider).first();
    if (!has) return json(ctx, { error: 'provider not linked' }, 400);
  }
  if (intent === 'link' && !isSteppedUp(cur.session)) return STEP_UP_REQUIRED(ctx);
  const b = await readJson(ctx.req);
  const r = await oauthStart(ctx, provider, { intent, cur, returnTo: b?.return_to ?? '/account' });
  if (r instanceof Response) return r;
  return json(ctx, { url: r.url }, 200, { 'Set-Cookie': r.cookie });
}

async function unlink(ctx, cur, provider) {
  if (!isSteppedUp(cur.session)) return STEP_UP_REQUIRED(ctx);
  const uid = cur.session.user_id;
  const u = await loadUser(ctx.env, uid);
  const ids = await listIdentities(ctx.env, uid);
  if (!ids.some((i) => i.provider === provider)) return json(ctx, { error: 'not found' }, 404);
  const remaining = ids.filter((i) => i.provider !== provider).length + (hasPassword(u) ? 1 : 0);
  if (remaining < 1) return json(ctx, { error: 'cannot remove last sign-in method' }, 409);
  await ctx.env.DB.prepare('DELETE FROM user_identities WHERE user_id = ?1 AND provider = ?2').bind(uid, provider).run();
  await audit(ctx, uid, 'identity.unlink', provider);
  return json(ctx, { ok: true });
}

// ---------- account ----------
const NAME_RE = /[\u0000-\u001F\u007F<>]/;
async function getAccountProfile(ctx, cur) {
  const uid = cur.session.user_id;
  const u = await loadUser(ctx.env, uid);
  const out = { display_name: await displayName(ctx.env, u), identifiers_locked: !isSteppedUp(cur.session) };
  if (!out.identifiers_locked) {
    const ids = await listIdentities(ctx.env, uid);
    out.sign_in_emails = await Promise.all(ids.filter((i) => i.email).map(async (i) => ({
      provider: i.provider, email: await decryptPii(ctx.env, i.email, i.email_key_version, `identity:${i.provider}:${i.sub}`),
      verified: !!i.email_verified, private_relay: !!i.is_private_relay,
    })));
    const p = await ctx.env.DB.prepare('SELECT payload_enc, key_version FROM profiles WHERE user_id = ?1').bind(uid).first();
    out.identifiers = p ? JSON.parse(await decryptPii(ctx.env, p.payload_enc, p.key_version, `profile:${uid}`)) : {};
  }
  return json(ctx, out);
}

async function patchAccountProfile(ctx, cur) {
  const uid = cur.session.user_id;
  const b = await readJson(ctx.req);
  if (!b) return json(ctx, { error: 'bad request' }, 400);
  const stmts = [];
  const t = now();
  if (b.display_name !== undefined) {
    const n = typeof b.display_name === 'string' ? b.display_name.trim().replace(/\s+/g, ' ') : null;
    if (n !== null && (n.length > 80 || NAME_RE.test(n))) return json(ctx, { error: 'invalid display_name' }, 400);
    if (n) {
      const { blob, version } = await encryptPii(ctx.env, n, `display:${uid}`);
      stmts.push(ctx.env.DB.prepare('UPDATE users SET display_name_enc = ?1, display_name_key_version = ?2 WHERE id = ?3').bind(blob, version, uid));
    } else {
      stmts.push(ctx.env.DB.prepare('UPDATE users SET display_name_enc = NULL, display_name_key_version = NULL WHERE id = ?1').bind(uid));
    }
  }
  if (b.identifiers !== undefined) {
    if (!isSteppedUp(cur.session)) return STEP_UP_REQUIRED(ctx);
    if (!b.identifiers || typeof b.identifiers !== 'object' || Array.isArray(b.identifiers)) return json(ctx, { error: 'bad request' }, 400);
    const plain = JSON.stringify(b.identifiers);
    if (plain.length > 8192) return json(ctx, { error: 'profile too large' }, 413);
    const { blob, version } = await encryptPii(ctx.env, plain, `profile:${uid}`);
    stmts.push(ctx.env.DB.prepare(
      `INSERT INTO profiles (user_id, payload_enc, key_version, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id) DO UPDATE SET payload_enc = excluded.payload_enc, key_version = excluded.key_version, updated_at = excluded.updated_at`,
    ).bind(uid, blob, version, t));
  }
  if (!stmts.length) return json(ctx, { error: 'bad request' }, 400);
  await ctx.env.DB.batch(stmts);
  await audit(ctx, uid, b.identifiers !== undefined ? 'profile.identifiers_update' : 'profile.display_name_update');
  return json(ctx, { ok: true });
}

async function accountOptouts(ctx, cur) {
  const r = await ctx.env.DB.prepare(
    `SELECT id, kind, status, sub_status, broker_id, service_id, created_at, updated_at, submitted_at, confirmed_at, finished_at, deadline
     FROM optout_requests WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 500`,
  ).bind(cur.session.user_id).all();
  return json(ctx, { optouts: r.results });
}

const publicSessionId = (idHash) => idHash.slice(0, 16);
async function listSessions(ctx, cur) {
  const r = await ctx.env.DB.prepare(
    "SELECT id_hash, auth_method, created_at, last_seen_at, expires_at FROM sessions WHERE user_id = ?1 AND stage = 'session' AND revoked = 0 AND expires_at > ?2 ORDER BY last_seen_at DESC LIMIT 50",
  ).bind(cur.session.user_id, now()).all();
  return json(ctx, { sessions: r.results.map((s) => ({
    id: publicSessionId(s.id_hash), auth_method: s.auth_method, created_at: s.created_at, last_seen_at: s.last_seen_at,
    expires_at: s.expires_at, current: s.id_hash === cur.idHash,
  })) });
}

async function revokeSession(ctx, cur, id) {
  if (!isSteppedUp(cur.session)) return STEP_UP_REQUIRED(ctx);
  const r = await ctx.env.DB.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?1 AND substr(id_hash, 1, 16) = ?2 AND stage = 'session'")
    .bind(cur.session.user_id, id).run();
  if (r.meta.changes < 1) return json(ctx, { error: 'not found' }, 404);
  await audit(ctx, cur.session.user_id, 'session.revoke', id);
  return json(ctx, { ok: true });
}

async function exportAccount(ctx, cur) {
  if (!isSteppedUp(cur.session)) return STEP_UP_REQUIRED(ctx);
  const uid = cur.session.user_id;
  const env = ctx.env;
  const u = await loadUser(env, uid);
  const ids = await listIdentities(env, uid);
  const prof = await env.DB.prepare('SELECT payload_enc, key_version FROM profiles WHERE user_id = ?1').bind(uid).first();
  const opts = (await env.DB.prepare('SELECT * FROM optout_requests WHERE user_id = ?1 ORDER BY created_at').bind(uid).all()).results;
  const pii = (await env.DB.prepare('SELECT p.request_id, p.payload_enc, p.key_version FROM pii_payloads p JOIN optout_requests o ON o.id = p.request_id WHERE o.user_id = ?1').bind(uid).all()).results;
  const piiById = {};
  for (const p of pii) piiById[p.request_id] = JSON.parse(await decryptPii(env, p.payload_enc, p.key_version, `pii:${p.request_id}`));
  const events = (await env.DB.prepare('SELECT action, target, at FROM audit_log WHERE user_id = ?1 ORDER BY at LIMIT 5000').bind(uid).all()).results;
  await audit(ctx, uid, 'account.export');
  const body = {
    exported_at: now(),
    user: { id: u.id, display_name: await displayName(env, u), has_password: hasPassword(u), totp_enabled: !!u.totp_enabled, created_at: u.created_at },
    identities: await Promise.all(ids.map(async (i) => ({ ...publicIdentity(i),
      email: i.email ? await decryptPii(env, i.email, i.email_key_version, `identity:${i.provider}:${i.sub}`) : null }))),
    identifiers: prof ? JSON.parse(await decryptPii(env, prof.payload_enc, prof.key_version, `profile:${uid}`)) : {},
    optouts: opts.map((o) => ({ ...o, pii: piiById[o.id] ?? null })),
    events,
  };
  return json(ctx, body, 200, { 'Content-Disposition': 'attachment; filename="account-export.json"' });
}

async function deleteAccount(ctx, cur) {
  if (!isSteppedUp(cur.session)) return STEP_UP_REQUIRED(ctx);
  const uid = cur.session.user_id;
  const db = ctx.env.DB;
  // Explicit deletes (children first) in one batch/transaction; FKs would cascade anyway.
  await db.batch([
    db.prepare('DELETE FROM pii_payloads WHERE request_id IN (SELECT id FROM optout_requests WHERE user_id = ?1)').bind(uid),
    db.prepare('DELETE FROM confirmations WHERE request_id IN (SELECT id FROM optout_requests WHERE user_id = ?1)').bind(uid),
    db.prepare('DELETE FROM optout_requests WHERE user_id = ?1').bind(uid),
    db.prepare('DELETE FROM profiles WHERE user_id = ?1').bind(uid),
    db.prepare('DELETE FROM backup_codes WHERE user_id = ?1').bind(uid),
    db.prepare('DELETE FROM user_identities WHERE user_id = ?1').bind(uid),
    db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(uid),
    db.prepare('DELETE FROM users WHERE id = ?1').bind(uid),
  ]);
  await audit(ctx, uid, 'account.delete'); // user id only; no PII remains
  return json(ctx, { ok: true }, 200, { 'Set-Cookie': clearCookie(ctx.env) });
}

// ---------- gate: POST /api/optouts/signup ----------
async function signup(ctx, cur) {
  const uid = cur.session.user_id;
  if (await isLimited(ctx.env, 'optout', uid)) return json(ctx, { error: 'too many requests' }, 429);
  const body = await readJson(ctx.req);
  const v = validateSignup(body);
  if (!v.ok) return json(ctx, v, 400); // static messages only; submitted values are never echoed
  const id = crypto.randomUUID();
  const t = now();
  const pii = { ...v.value, jurisdiction: 'TDPSA', nonTexasFlag: !v.value.texasResident };
  const { blob, version } = await encryptPii(ctx.env, JSON.stringify(pii), `pii:${id}`);
  const hardMax = (Number(ctx.env.PII_HARD_MAX_DAYS) > 0 ? Number(ctx.env.PII_HARD_MAX_DAYS) : 90) * 86400;
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO optout_requests (id, user_id, broker_id, status, created_at, updated_at, kind, service_id, sub_status)
       VALUES (?1, ?2, NULL, 'queued', ?3, ?3, 'tx', 'signup', ?4)`,
    ).bind(id, uid, t, pii.nonTexasFlag ? 'non_texas' : null),
    ctx.env.DB.prepare('INSERT INTO pii_payloads (request_id, payload_enc, key_version, created_at, purge_after) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(id, blob, version, t, t + hardMax),
  ]);
  await hit(ctx.env, 'optout', uid);
  await audit(ctx, uid, 'optout.signup', id);
  return json(ctx, { ok: true, id });
}

// ---------- router ----------
export async function handleApi(req, env) {
  const origin = req.headers.get('Origin');
  const ctx = { req, env, origin };
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;

  // Apple's form_post callback is a cross-site POST (Origin https://appleid.apple.com or null); it is protected by
  // the sealed single-use state cookie instead of the Origin/CSRF checks.
  if (isAppleCallback(m, path)) return callback(ctx, 'apple');
  if (STATE_CHANGING.has(m) && !(origin && allowedOrigins(env).includes(origin))) return FORBIDDEN(ctx);

  if (LEGACY_AUTH_ALIASES.has(path)) {
    const u = new URL(req.url); u.pathname = path.slice(4);
    return handleApp(new Request(u, req), env);
  }

  let pm = path.match(/^\/api\/auth\/(google|apple|microsoft)\/(start|callback)$/);
  if (pm && m === 'GET') return pm[2] === 'start' ? startLogin(ctx, pm[1]) : callback(ctx, pm[1]);

  const cur = await requireSession(ctx);
  if (!cur) return UNAUTH(ctx);
  if (STATE_CHANGING.has(m) && !timingSafeEqual(req.headers.get('X-CSRF-Token') || '', cur.session.csrf || '')) return FORBIDDEN(ctx);

  if (m === 'GET' && path === '/api/me') return me(ctx, cur);
  if (m === 'POST' && path === '/api/auth/logout') return logout(ctx, cur);
  if (cur.limited) return json(ctx, { error: 'mfa required' }, 403); // password session that hasn't finished TOTP

  if (m === 'POST' && path === '/api/auth/stepup/password') return stepUpPassword(ctx, cur);
  pm = path.match(/^\/api\/auth\/(google|apple|microsoft)\/stepup$/);
  if (pm && m === 'POST') return startBound(ctx, cur, pm[1], 'stepup');
  pm = path.match(/^\/api\/account\/identities\/(google|apple|microsoft)(\/link)?$/);
  if (pm && m === 'POST' && pm[2]) return startBound(ctx, cur, pm[1], 'link');
  if (pm && m === 'DELETE' && !pm[2]) return unlink(ctx, cur, pm[1]);

  if (m === 'GET' && path === '/api/account/profile') return getAccountProfile(ctx, cur);
  if (m === 'PATCH' && path === '/api/account/profile') return patchAccountProfile(ctx, cur);
  if (m === 'GET' && path === '/api/account/optouts') return accountOptouts(ctx, cur);
  if (m === 'GET' && path === '/api/account/sessions') return listSessions(ctx, cur);
  pm = path.match(/^\/api\/account\/sessions\/([0-9a-f]{16})\/revoke$/);
  if (pm && m === 'POST') return revokeSession(ctx, cur, pm[1]);
  if (m === 'GET' && path === '/api/account/export') return exportAccount(ctx, cur);
  if (m === 'POST' && path === '/api/account/delete') return deleteAccount(ctx, cur);
  if (m === 'POST' && path === '/api/optouts/signup') return signup(ctx, cur);
  return json(ctx, { error: 'not found' }, 404);
}

export { PROVIDERS };
