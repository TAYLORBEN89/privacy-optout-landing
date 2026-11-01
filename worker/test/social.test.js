// Social sign-in, step-up, account API and the opt-out gate. Provider token + JWKS endpoints are mocked with
// throwaway keypairs generated per run; no network access.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT, decodeJwt } from 'jose';
import { authenticator } from 'otplib';
import { hashPassword, encryptStr } from '../src/crypto.js';
import { MS_CONSUMER_TID } from '../src/oauth.js';

const ORIGIN = 'http://localhost:5173';
const BASE = 'https://api.test';
const UA = 'TestAgent/1.0 (ua-marker-7f3a)';
const ORG_TID = '11111111-2222-3333-4444-555555555555';
let IP; let n = 0;

const keys = {};
const ALG = { google: 'RS256', microsoft: 'RS256', apple: 'ES256' };
const AUD = { google: 'test-google-client', microsoft: 'test-ms-client', apple: 'test.apple.services' };
const JWKS = {
  'https://www.googleapis.com/oauth2/v3/certs': 'google',
  'https://appleid.apple.com/auth/keys': 'apple',
  'https://login.microsoftonline.com/common/discovery/v2.0/keys': 'microsoft',
};
const TOKEN = {
  'https://oauth2.googleapis.com/token': 'google',
  'https://appleid.apple.com/auth/token': 'apple',
  'https://login.microsoftonline.com/common/oauth2/v2.0/token': 'microsoft',
};
let nextClaims = {}; // provider -> claims for the next token response
const tokenRequests = [];
let realFetch;

beforeAll(async () => {
  for (const p of Object.keys(ALG)) {
    const { publicKey, privateKey } = await generateKeyPair(ALG[p], { extractable: true });
    keys[p] = { privateKey, jwk: { ...(await exportJWK(publicKey)), kid: `${p}-kid`, alg: ALG[p], use: 'sig' } };
  }
  realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const r = input instanceof Request ? input : new Request(input, init);
    const u = r.url.split('?')[0];
    if (JWKS[u]) return Response.json({ keys: [keys[JWKS[u]].jwk] });
    if (TOKEN[u]) {
      const p = TOKEN[u];
      tokenRequests.push({ p, body: await r.text(), auth: r.headers.get('Authorization') });
      const c = nextClaims[p];
      if (!c) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      const id_token = await new SignJWT(c).setProtectedHeader({ alg: ALG[p], kid: `${p}-kid` }).sign(keys[p].privateKey);
      return Response.json({ access_token: 'provider-access-token', refresh_token: 'provider-refresh-token', token_type: 'Bearer', expires_in: 3600, id_token });
    }
    return realFetch(input, init);
  });
});
afterAll(() => vi.restoreAllMocks());

beforeEach(async () => {
  IP = `10.9.0.${++n}`;
  nextClaims = {};
  tokenRequests.length = 0;
  await env.DB.batch(['audit_log', 'user_identities', 'oauth_states_used', 'confirmations', 'pii_payloads', 'optout_requests', 'profiles', 'backup_codes', 'sessions', 'users']
    .map((t) => env.DB.prepare(`DELETE FROM ${t}`))); // test-only fixed table names
});

const t0 = () => Math.floor(Date.now() / 1000);
function claimsFor(p, { sub = 'subject-1', email = 'person@example.test', nonce, tid = ORG_TID, ...extra } = {}) {
  const base = { sub, email, nonce, aud: AUD[p], iat: t0(), exp: t0() + 600 };
  if (p === 'google') return { ...base, iss: 'https://accounts.google.com', email_verified: true, ...extra };
  if (p === 'apple') return { ...base, iss: 'https://appleid.apple.com', email_verified: 'true', ...extra };
  return { ...base, iss: `https://login.microsoftonline.com/${tid}/v2.0`, tid, ...extra };
}

const H = (extra = {}) => ({ Origin: ORIGIN, 'CF-Connecting-IP': IP, 'User-Agent': UA, ...extra });
const setCookies = (r) => r.headers.getSetCookie();
const cookieVal = (r, name) => { const c = setCookies(r).find((x) => x.startsWith(`${name}=`)); return c ? c.split(';')[0] : null; };

async function start(p, returnTo = '/account') {
  const r = await SELF.fetch(`${BASE}/api/auth/${p}/start?return_to=${encodeURIComponent(returnTo)}`, { headers: { 'CF-Connecting-IP': IP, 'User-Agent': UA }, redirect: 'manual' });
  return r;
}
function parseStart(r) {
  const loc = new URL(r.headers.get('Location'));
  return { loc, state: loc.searchParams.get('state'), nonce: loc.searchParams.get('nonce'), oauth: cookieVal(r, '__Host-oauth') };
}
async function callback(p, { state, oauth, cookie = '', code = 'auth-code' }) {
  const Cookie = [oauth, cookie].filter(Boolean).join('; ');
  if (p === 'apple') {
    return SELF.fetch(`${BASE}/api/auth/apple/callback`, {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://appleid.apple.com', 'CF-Connecting-IP': IP, 'User-Agent': UA, Cookie },
      body: new URLSearchParams({ state, code }).toString(),
    });
  }
  return SELF.fetch(`${BASE}/api/auth/${p}/callback?state=${encodeURIComponent(state)}&code=${code}`, { redirect: 'manual', headers: H({ Cookie }) });
}
// Full login; returns { sid, csrf, res }.
async function socialLogin(p, claimOpts = {}, returnTo = '/account') {
  const s = parseStart(await start(p, returnTo));
  nextClaims[p] = claimsFor(p, { nonce: s.nonce, ...claimOpts });
  const res = await callback(p, s);
  const sid = cookieVal(res, '__Host-sid');
  let csrf = null;
  if (sid) csrf = (await (await SELF.fetch(`${BASE}/api/me`, { headers: H({ Cookie: sid }) })).json()).csrf_token;
  return { sid, csrf, res, s };
}
const api = (method, path, { sid, csrf } = {}, body, extra = {}) => SELF.fetch(BASE + path, {
  method, redirect: 'manual',
  headers: H({ 'Content-Type': 'application/json', ...(sid ? { Cookie: sid } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...extra }),
  body: body === undefined ? undefined : JSON.stringify(body),
});
const expireStepUp = (sid) => env.DB.prepare('UPDATE sessions SET stepped_up_at = ?1').bind(t0() - 601).run();
const countUsers = async () => (await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first()).c;

describe('social login happy paths', () => {
  for (const p of ['google', 'apple', 'microsoft']) {
    it(`${p}: creates a user + identity, sets a Lax session cookie, redirects to return_to`, async () => {
      const { res, sid, s } = await socialLogin(p);
      expect(res.status).toBe(303);
      expect(res.headers.get('Location')).toBe('/account');
      expect(s.loc.searchParams.get('nonce')).toBeTruthy();
      if (p !== 'apple') expect(s.loc.searchParams.get('code_challenge_method')).toBe('S256');
      else expect(s.loc.searchParams.get('response_mode')).toBe('form_post');
      const sc = setCookies(res).find((c) => c.startsWith('__Host-sid='));
      for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(sc).toContain(a);
      expect(setCookies(res).some((c) => c.startsWith('__Host-oauth=;') && c.includes('Max-Age=0'))).toBe(true);
      const me = await (await SELF.fetch(`${BASE}/api/me`, { headers: H({ Cookie: sid }) })).json();
      expect(me.providers.map((x) => x.provider)).toEqual([p]);
      expect(me.user.has_password).toBe(false);
      expect(me.csrf_token).toBeTruthy();
      const row = await env.DB.prepare('SELECT * FROM user_identities').first();
      expect(row.provider).toBe(p);
      expect(row.email).not.toContain('@example.test'); // encrypted at rest
      // provider tokens are never stored anywhere
      const dump = JSON.stringify((await env.DB.prepare('SELECT * FROM sessions').all()).results) + JSON.stringify(row);
      expect(dump).not.toContain('provider-access-token');
      expect(dump).not.toContain('provider-refresh-token');
      // second login reuses the same user
      await socialLogin(p);
      expect(await countUsers()).toBe(1);
    });
  }

  it('apple: client_secret is an ES256 JWT generated at runtime; private relay flagged; email kept when later omitted', async () => {
    await socialLogin('apple', { email: 'abc123@privaterelay.appleid.com', is_private_email: 'true' });
    const body = new URLSearchParams(tokenRequests[0].body);
    const cs = body.get('client_secret');
    const hdr = JSON.parse(atob(cs.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    expect(hdr).toMatchObject({ alg: 'ES256', kid: 'TESTKEY001' });
    expect(decodeJwt(cs)).toMatchObject({ iss: 'TESTTEAM01', sub: 'test.apple.services' });
    let row = await env.DB.prepare('SELECT * FROM user_identities').first();
    expect(row.is_private_relay).toBe(1);
    const before = row.email;
    await socialLogin('apple', { email: null });
    row = await env.DB.prepare('SELECT * FROM user_identities').first();
    expect(row.email).toBe(before);
  });

  it('microsoft: email verified only for consumer tenant or xms_edov', async () => {
    await socialLogin('microsoft', { sub: 'a' });
    await socialLogin('microsoft', { sub: 'b', xms_edov: true });
    await socialLogin('microsoft', { sub: 'c', tid: MS_CONSUMER_TID });
    const rows = (await env.DB.prepare('SELECT sub, email_verified FROM user_identities ORDER BY sub').all()).results;
    expect(rows.map((r) => r.email_verified)).toEqual([0, 1, 1]);
  });
});

describe('callback rejections', () => {
  const failOf = async (res) => { expect(res.status).toBe(303); expect(cookieVal(res, '__Host-sid')).toBeNull(); return res.headers.get('Location'); };

  it('bad state', async () => {
    const s = parseStart(await start('google'));
    nextClaims.google = claimsFor('google', { nonce: s.nonce });
    expect(await failOf(await callback('google', { ...s, state: 'tampered' }))).toBe('/start?auth_error=bad_state');
    expect(await failOf(await callback('google', { ...s, oauth: null }))).toBe('/start?auth_error=bad_state');
    expect(await failOf(await callback('google', { ...s, oauth: '__Host-oauth=AAAA.BBBB' }))).toBe('/start?auth_error=bad_state');
  });

  it('reused state cookie', async () => {
    const s = parseStart(await start('google'));
    nextClaims.google = claimsFor('google', { nonce: s.nonce });
    expect((await callback('google', s)).headers.get('Location')).toBe('/account');
    expect(await failOf(await callback('google', s))).toBe('/start?auth_error=state_reused');
  });

  it('state cookie for another provider is refused', async () => {
    const s = parseStart(await start('google'));
    nextClaims.microsoft = claimsFor('microsoft', { nonce: s.nonce });
    expect(await failOf(await callback('microsoft', s))).toBe('/start?auth_error=bad_state');
  });

  const cases = [
    ['wrong nonce', 'google', { nonce: 'wrong' }, 'nonce_mismatch'],
    ['wrong aud', 'google', { aud: 'someone-else' }, 'bad_aud'],
    ['wrong iss (google)', 'google', { iss: 'https://evil.example' }, 'bad_iss'],
    ['wrong iss (apple)', 'apple', { iss: 'https://evil.example' }, 'bad_iss'],
    ['microsoft iss not matching tid', 'microsoft', { iss: 'https://login.microsoftonline.com/99999999-2222-3333-4444-555555555555/v2.0' }, 'bad_iss'],
    ['expired token', 'google', { exp: Math.floor(Date.now() / 1000) - 3600, iat: Math.floor(Date.now() / 1000) - 7200 }, 'token_expired'],
    ['future iat', 'apple', { iat: Math.floor(Date.now() / 1000) + 3600 }, 'bad_claims'],
  ];
  for (const [name, p, over, reason] of cases) {
    it(name, async () => {
      const s = parseStart(await start(p));
      nextClaims[p] = { ...claimsFor(p, { nonce: s.nonce }), ...over };
      expect(await failOf(await callback(p, s))).toBe(`/start?auth_error=${reason}`);
      const a = await env.DB.prepare("SELECT target FROM audit_log WHERE action = 'auth.fail'").first();
      expect(a.target).toBe(`${p}:${reason}`);
      expect(await countUsers()).toBe(0);
    });
  }

  it('token exchange failure', async () => {
    const s = parseStart(await start('google'));
    expect(await failOf(await callback('google', s))).toBe('/start?auth_error=token_exchange');
  });
});

describe('identity linking', () => {
  it('a matching email does NOT link: same email on another provider creates a separate user', async () => {
    await socialLogin('google', { email: 'same@example.test' });
    await socialLogin('microsoft', { email: 'same@example.test', tid: MS_CONSUMER_TID });
    expect(await countUsers()).toBe(2);
    // and a password user with that email is not linked either
    expect((await env.DB.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM user_identities').first()).c).toBe(2);
  });

  it('link requires step-up within 10 minutes; then links via OAuth with intent=link', async () => {
    const a = await socialLogin('google');
    await expireStepUp();
    let r = await api('POST', '/api/account/identities/microsoft/link', a, {});
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('step_up_required');
    // step up with google
    r = await api('POST', '/api/auth/google/stepup', a, {});
    expect(r.status).toBe(200);
    const su = await r.json();
    const loc = new URL(su.url);
    expect(loc.searchParams.get('max_age')).toBe('0');
    nextClaims.google = claimsFor('google', { nonce: loc.searchParams.get('nonce'), auth_time: t0() });
    r = await callback('google', { state: loc.searchParams.get('state'), oauth: cookieVal(r, '__Host-oauth'), cookie: a.sid });
    expect(r.headers.get('Location')).toBe('/account');
    // now link microsoft
    r = await api('POST', '/api/account/identities/microsoft/link', a, {});
    expect(r.status).toBe(200);
    const l = new URL((await r.json()).url);
    expect(l.searchParams.get('prompt')).toBe('login');
    nextClaims.microsoft = claimsFor('microsoft', { nonce: l.searchParams.get('nonce') });
    r = await callback('microsoft', { state: l.searchParams.get('state'), oauth: cookieVal(r, '__Host-oauth'), cookie: a.sid });
    expect(r.headers.get('Location')).toBe('/account');
    const me = await (await api('GET', '/api/me', a)).json();
    expect(me.providers.map((x) => x.provider).sort()).toEqual(['google', 'microsoft']);
    expect(await countUsers()).toBe(1);
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'identity.link' AND target = 'microsoft'").first()).toBeTruthy();
  });

  it('linking an identity owned by another user is refused', async () => {
    await socialLogin('microsoft', { sub: 'taken' });
    const a = await socialLogin('google');
    const r = await api('POST', '/api/account/identities/microsoft/link', a, {});
    const l = new URL((await r.json()).url);
    nextClaims.microsoft = claimsFor('microsoft', { sub: 'taken', nonce: l.searchParams.get('nonce') });
    const cb = await callback('microsoft', { state: l.searchParams.get('state'), oauth: cookieVal(r, '__Host-oauth'), cookie: a.sid });
    expect(cb.headers.get('Location')).toBe('/start?auth_error=identity_in_use');
  });

  it('unlink requires step-up and refuses to remove the last sign-in method', async () => {
    const a = await socialLogin('google');
    let r = await api('DELETE', '/api/account/identities/google', a);
    expect(r.status).toBe(409);
    await expireStepUp();
    r = await api('DELETE', '/api/account/identities/google', a);
    expect(r.status).toBe(403);
    expect(await env.DB.prepare('SELECT COUNT(*) AS c FROM user_identities').first()).toEqual({ c: 1 });
  });
});

describe('return_to open-redirect protection', () => {
  const attempts = ['https://evil.example', '//evil.example', '/\\evil.example', '/account/../../x', '/start#step-1x', 'javascript:alert(1)', '/startx', '/account?next=//evil'];
  for (const a of attempts) {
    it(`falls back to /start for ${a}`, async () => {
      const { res } = await socialLogin('google', {}, a);
      expect(res.headers.get('Location')).toBe('/start');
    });
  }
  it('allows /start#step-3', async () => {
    const { res } = await socialLogin('google', {}, '/start#step-3');
    expect(res.headers.get('Location')).toBe('/start#step-3');
  });
});

describe('CSRF / Origin', () => {
  it('state-changing /api routes reject a missing CSRF token, a wrong token, a foreign Origin and no Origin', async () => {
    const a = await socialLogin('google');
    const body = { fullName: 'Pat Example', mailingAddress: '1 Main St, Somewhere, TX 75001', email: 'p@example.test', texasResident: true };
    expect((await api('POST', '/api/optouts/signup', { sid: a.sid }, body)).status).toBe(403);
    expect((await api('POST', '/api/optouts/signup', { sid: a.sid, csrf: 'nope' }, body)).status).toBe(403);
    expect((await api('POST', '/api/optouts/signup', a, body, { Origin: 'https://evil.example' })).status).toBe(403);
    const r = await SELF.fetch(`${BASE}/api/optouts/signup`, { method: 'POST', headers: { Cookie: a.sid, 'X-CSRF-Token': a.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect(r.status).toBe(403);
    expect((await api('POST', '/api/auth/logout', { sid: a.sid })).status).toBe(403);
  });
});

describe('rate limits', () => {
  it('limits OAuth starts per IP', async () => {
    for (let i = 0; i < 30; i++) expect((await start('google')).status).toBe(302);
    expect((await start('google')).status).toBe(429);
  });
  it('limits OAuth callbacks per IP', async () => {
    for (let i = 0; i < 30; i++) await callback('google', { state: 'x', oauth: null });
    expect((await callback('google', { state: 'x', oauth: null })).status).toBe(429);
  });
});

describe('POST /api/optouts/signup (gate)', () => {
  const good = { fullName: 'Pat Example', mailingAddress: '1 Main St, Somewhere, TX 75001', email: 'Pat@Example.test', texasResident: false };
  it('401 without a session', async () => {
    expect((await api('POST', '/api/optouts/signup', {}, good)).status).toBe(401);
  });
  it('200 with a session: encrypted per-user row, TDPSA + nonTexasFlag, no PII echoed', async () => {
    const a = await socialLogin('google');
    const r = await api('POST', '/api/optouts/signup', a, good);
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).not.toContain('Pat');
    const { ok, id } = JSON.parse(text);
    expect(ok).toBe(true);
    const row = await env.DB.prepare('SELECT * FROM optout_requests WHERE id = ?1').bind(id).first();
    expect(row).toMatchObject({ status: 'queued', kind: 'tx', sub_status: 'non_texas' });
    const p = await env.DB.prepare('SELECT payload_enc FROM pii_payloads WHERE request_id = ?1').bind(id).first();
    expect(p.payload_enc).not.toContain('Pat');
    const exp = await (await api('GET', '/api/account/export', a)).json();
    expect(exp.optouts[0].pii).toMatchObject({ fullName: 'Pat Example', email: 'pat@example.test', jurisdiction: 'TDPSA', nonTexasFlag: true });
    const list = await (await api('GET', '/api/account/optouts', a)).json();
    expect(list.optouts).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain('Pat');
  });
  it('validation errors use the shared rules and never echo values', async () => {
    const a = await socialLogin('google');
    const r = await api('POST', '/api/optouts/signup', a, { fullName: 'Madonna', mailingAddress: 'x', email: 'bad<script>', texasResident: 'yes' });
    expect(r.status).toBe(400);
    const b = await r.json();
    expect(Object.keys(b.errors).sort()).toEqual(['email', 'fullName', 'mailingAddress', 'texasResident']);
    expect(JSON.stringify(b)).not.toContain('Madonna');
    expect((await api('POST', '/api/optouts/signup', a, [])).status).toBe(400);
  });
  it('opt-out rows are per-user', async () => {
    const a = await socialLogin('google', { sub: 'one' });
    await api('POST', '/api/optouts/signup', a, good);
    const b = await socialLogin('google', { sub: 'two' });
    expect((await (await api('GET', '/api/account/optouts', b)).json()).optouts).toHaveLength(0);
  });
});

describe('account API + step-up', () => {
  it('profile: display name always; identifiers only within step-up', async () => {
    const a = await socialLogin('google');
    expect((await api('PATCH', '/api/account/profile', a, { display_name: 'Pat' })).status).toBe(200);
    let p = await (await api('GET', '/api/account/profile', a)).json();
    expect(p).toMatchObject({ display_name: 'Pat', identifiers_locked: false });
    expect(p.sign_in_emails[0].email).toBe('person@example.test');
    await expireStepUp();
    p = await (await api('GET', '/api/account/profile', a)).json();
    expect(p.identifiers_locked).toBe(true);
    expect(p.sign_in_emails).toBeUndefined();
    expect((await api('PATCH', '/api/account/profile', a, { identifiers: { names: ['x'] } })).status).toBe(403);
    expect((await api('PATCH', '/api/account/profile', a, { display_name: '<b>' })).status).toBe(400);
  });

  it('step-up expiry blocks export, delete and session revoke', async () => {
    const a = await socialLogin('google');
    await expireStepUp();
    expect((await api('GET', '/api/account/export', a)).status).toBe(403);
    expect((await api('POST', '/api/account/delete', a)).status).toBe(403);
    const sess = await (await api('GET', '/api/account/sessions', a)).json();
    expect(sess.sessions[0].current).toBe(true);
    expect((await api('POST', `/api/account/sessions/${sess.sessions[0].id}/revoke`, a)).status).toBe(403);
  });

  it('session revoke with step-up', async () => {
    const a = await socialLogin('google');
    const b = await socialLogin('google');
    const sess = (await (await api('GET', '/api/account/sessions', b)).json()).sessions;
    const other = sess.find((s) => !s.current);
    expect((await api('POST', `/api/account/sessions/${other.id}/revoke`, b)).status).toBe(200);
    expect((await api('GET', '/api/me', a)).status).toBe(401);
  });

  it('account delete removes the user rows and PII and writes an audit entry', async () => {
    const a = await socialLogin('google');
    await api('POST', '/api/optouts/signup', a, { fullName: 'Pat Example', mailingAddress: '1 Main St, Somewhere, TX 75001', email: 'p@example.test', texasResident: true });
    const r = await api('POST', '/api/account/delete', a);
    expect(r.status).toBe(200);
    for (const t of ['users', 'user_identities', 'sessions', 'optout_requests', 'pii_payloads', 'profiles']) {
      expect((await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${t}`).first()).c).toBe(0); // test-only fixed table names
    }
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'account.delete'").first()).toBeTruthy();
    expect((await api('GET', '/api/me', a)).status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const a = await socialLogin('google');
    expect((await api('POST', '/api/auth/logout', a)).status).toBe(200);
    expect((await api('GET', '/api/me', a)).status).toBe(401);
  });

  it('/api/me is 401 without a session', async () => {
    expect((await api('GET', '/api/me')).status).toBe(401);
  });
});

describe('password + TOTP fallback', () => {
  async function pwUser() {
    const id = crypto.randomUUID();
    const secret = authenticator.generateSecret(20);
    await env.DB.prepare('INSERT INTO users (id, email, pw_hash, totp_secret_enc, totp_enabled, created_at) VALUES (?1, ?2, ?3, ?4, 1, 1)')
      .bind(id, 'pw@example.test', await hashPassword('correct horse battery'), await encryptStr(env, secret)).run();
    return secret;
  }
  it('works same-origin under /api/auth/* and can step up with password + TOTP', async () => {
    const secret = await pwUser();
    let r = await api('POST', '/api/auth/login', {}, { email: 'pw@example.test', password: 'correct horse battery' });
    const { preauth_token } = await r.json();
    r = await api('POST', '/api/auth/totp/verify', {}, { preauth_token, code: authenticator.generate(secret) });
    expect(r.status).toBe(200);
    const a = { sid: cookieVal(r, '__Host-sid'), csrf: (await r.json()).csrf_token };
    expect((await (await api('GET', '/api/me', a)).json()).user.has_password).toBe(true);
    await expireStepUp();
    expect((await api('POST', '/api/auth/stepup/password', a, { password: 'wrong', code: '000000' })).status).toBe(401);
  });
  it('social-only users can never log in with a password', async () => {
    await socialLogin('google');
    const u = await env.DB.prepare('SELECT email FROM users').first();
    const r = await api('POST', '/api/auth/login', {}, { email: u.email, password: '!' });
    expect(r.status).toBe(401);
  });
});

describe('audit IP / user-agent', () => {
  it('fills ip and user_agent (<=512 chars) on audit rows and never logs them', async () => {
    const logged = [];
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((k) => vi.spyOn(console, k).mockImplementation((...a) => { logged.push(a.map(String).join(' ')); }));
    try {
      await socialLogin('google');
      const s = parseStart(await start('google'));
      await callback('google', { ...s, state: 'bad' }); // failure path
      const long = 'L'.repeat(600);
      await SELF.fetch(`${BASE}/api/auth/google/callback?state=x&code=y`, { redirect: 'manual', headers: { 'CF-Connecting-IP': IP, 'User-Agent': long } });
      const rows = (await env.DB.prepare('SELECT action, ip, user_agent FROM audit_log ORDER BY id').all()).results;
      expect(rows.length).toBeGreaterThan(2);
      for (const r of rows) expect(r.ip).toBe(IP);
      expect(rows.slice(0, -1).every((r) => r.user_agent === UA)).toBe(true);
      expect(rows.at(-1).user_agent).toHaveLength(512);
    } finally { spies.forEach((s) => s.mockRestore()); }
    const out = logged.join('\n');
    expect(out).not.toContain(IP);
    expect(out).not.toContain('ua-marker-7f3a');
  });
  it('ip is NULL when CF-Connecting-IP is absent', async () => {
    await SELF.fetch(`${BASE}/api/auth/google/callback?state=x&code=y`, { redirect: 'manual' });
    const r = await env.DB.prepare('SELECT ip FROM audit_log').first();
    expect(r.ip).toBeNull();
  });
});
