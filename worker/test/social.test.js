// Social sign-in, step-up, account API and the opt-out gate. Provider token + JWKS endpoints are mocked with
// throwaway keypairs generated per run; no network access.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { authenticator } from 'otplib';
import { hashPassword, encryptStr } from '../src/crypto.js';
import { clearOauthCookie } from '../src/oauth.js';
import { auditMeta } from '../src/app.js';

const ORIGIN = 'http://localhost:5173';
const BASE = 'https://api.test';
const UA = 'TestAgent/1.0 (ua-marker-7f3a)';
const ORG_TID = '11111111-2222-3333-4444-555555555555';
let IP; let n = 0;

const keys = {};
const ALG = { google: 'RS256', microsoft: 'RS256' };
const AUD = { google: 'test-google-client', microsoft: 'test-ms-client' };
const JWKS = {
  'https://www.googleapis.com/oauth2/v3/certs': 'google',
  'https://login.microsoftonline.com/common/discovery/v2.0/keys': 'microsoft',
};
const TOKEN = {
  'https://oauth2.googleapis.com/token': 'google',
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
  await env.DB.batch(['user_identities', 'oauth_states_used', 'confirmations', 'pii_payloads', 'optout_requests', 'profiles', 'backup_codes', 'sessions', 'users']
    .map((t) => env.DB.prepare(`DELETE FROM ${t}`))); // test-only fixed table names
});

const t0 = () => Math.floor(Date.now() / 1000);
function claimsFor(p, { sub = 'subject-1', email = 'person@example.test', nonce, tid = ORG_TID, ...extra } = {}) {
  const base = { sub, email, nonce, aud: AUD[p], iat: t0(), exp: t0() + 600, auth_time: t0() };
  if (p === 'google') return { ...base, iss: 'https://accounts.google.com', email_verified: true, ...extra };
  return { ...base, iss: `https://login.microsoftonline.com/${tid}/v2.0`, tid, ...extra };
}

const H = (extra = {}) => ({ Origin: ORIGIN, 'CF-Connecting-IP': IP, 'User-Agent': UA, ...extra });
const setCookies = (r) => r.headers.getSetCookie();
const cookieVal = (r, name) => { const c = setCookies(r).find((x) => x.startsWith(`${name}=`)); return c ? c.split(';')[0] : null; };

const ACC = 'https://accounts.test';
// Apex /api/auth/{p}/start -> accounts host /oauth/{p}/start -> provider. Returns the accounts-host response.
async function start(p, returnTo = '/account') {
  const r = await SELF.fetch(`${BASE}/api/auth/${p}/start?return_to=${encodeURIComponent(returnTo)}`, { headers: { 'CF-Connecting-IP': IP, 'User-Agent': UA }, redirect: 'manual' });
  expect(r.status).toBe(302);
  browser = cookieVal(r, '__Host-login');
  expect(browser).toBeTruthy();
  const next = r.headers.get('Location');
  expect(next.startsWith(`${ACC}/oauth/${p}/start?`)).toBe(true);
  return SELF.fetch(next, { headers: { 'CF-Connecting-IP': IP, 'User-Agent': UA }, redirect: 'manual' });
}
function parseStart(r) {
  const loc = new URL(r.headers.get('Location'));
  return { loc, state: loc.searchParams.get('state'), nonce: loc.searchParams.get('nonce'), oauth: cookieVal(r, '__Host-oauth') };
}
// Provider -> accounts host callback (only the __Host-oauth cookie; __Host-sid is host-only on the apex) ->
// handoff -> apex /api/auth/complete with the apex cookie. Returns the final response (or the failure redirect).
let browser = null; // __Host-login set on the apex by the last start/bound
async function callback(p, { state, oauth, cookie = '', code = 'auth-code', login }) {
  const r = await SELF.fetch(`${ACC}/oauth/${p}/callback?state=${encodeURIComponent(state)}&code=${code}`,
    { redirect: 'manual', headers: { 'CF-Connecting-IP': IP, 'User-Agent': UA, ...(oauth ? { Cookie: oauth } : {}) } });
  const loc = r.headers.get('Location') || '';
  if (!loc.startsWith(`${BASE}/api/auth/complete?code=`)) return r;
  lastHandoff = loc;
  const jar = [cookie, login === undefined ? browser : login].filter(Boolean).join('; ');
  const done = await SELF.fetch(loc, { redirect: 'manual', headers: { 'CF-Connecting-IP': IP, 'User-Agent': UA, ...(jar ? { Cookie: jar } : {}) } });
  done.first = r;
  return done;
}
let lastHandoff = null;
// Step-up / link: the apex returns {action, method:'POST', fields:{st}} and sets __Host-login; the browser
// form-POSTs st to the accounts host (Origin = app origin), which redirects to the provider.
const postForm = (action, fields, origin = BASE) => SELF.fetch(action, { method: 'POST', redirect: 'manual',
  headers: { 'CF-Connecting-IP': IP, 'User-Agent': UA, Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString() });
async function bound(apexRes) {
  const body = await apexRes.json();
  expect(body.method).toBe('POST');
  expect(body.action.startsWith(`${ACC}/oauth/`) && body.action.endsWith('/bound')).toBe(true);
  expect(JSON.stringify(body)).not.toContain('url');
  browser = cookieVal(apexRes, '__Host-login');
  expect(browser).toBeTruthy();
  const url = body.action; const tok = body.fields.st;
  const r = await postForm(url, body.fields);
  const loc = new URL(r.headers.get('Location'));
  return { url, tok, loc, state: loc.searchParams.get('state'), oauth: cookieVal(r, '__Host-oauth') };
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
  for (const p of ['google', 'microsoft']) {
    it(`${p}: creates a user + identity, sets a Lax session cookie, redirects to return_to`, async () => {
      const { res, sid, s } = await socialLogin(p);
      expect(res.status).toBe(303);
      expect(res.headers.get('Location')).toBe('/account');
      expect(s.loc.searchParams.get('nonce')).toBeTruthy();
      expect(s.loc.searchParams.get('code_challenge_method')).toBe('S256');
      expect(setCookies(await start(p)).find((c) => c.startsWith('__Host-oauth='))).toContain('SameSite=Lax');
      const sc = setCookies(res).find((c) => c.startsWith('__Host-sid='));
      for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(sc).toContain(a);
      expect(setCookies(res.first).some((c) => c.startsWith('__Host-oauth=;') && c.includes('Max-Age=0'))).toBe(true);
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

  it('email is kept when the provider later omits it', async () => {
    await socialLogin('google');
    const before = (await env.DB.prepare('SELECT email FROM user_identities').first()).email;
    await socialLogin('google', { email: null });
    expect((await env.DB.prepare('SELECT email FROM user_identities').first()).email).toBe(before);
  });

  it('microsoft: email verified only via xms_edov (no consumer-tenant shortcut)', async () => {
    await socialLogin('microsoft', { sub: 'a' });
    await socialLogin('microsoft', { sub: 'b', xms_edov: true });
    await socialLogin('microsoft', { sub: 'c', tid: '9188040d-6c67-4c5b-b112-36a304b66dad' });
    const rows = (await env.DB.prepare('SELECT sub, email_verified FROM user_identities ORDER BY sub').all()).results;
    expect(rows.map((r) => r.email_verified)).toEqual([0, 1, 0]);
  });
});

describe('callback rejections', () => {
  const failOf = async (res) => { expect(res.status).toBe(303); expect(cookieVal(res, '__Host-sid')).toBeNull(); return res.headers.get('Location'); };

  it('bad state', async () => {
    const s = parseStart(await start('google'));
    nextClaims.google = claimsFor('google', { nonce: s.nonce });
    expect(await failOf(await callback('google', { ...s, state: 'tampered' }))).toBe(BASE + '/start?auth_error=bad_state');
    expect(await failOf(await callback('google', { ...s, oauth: null }))).toBe(BASE + '/start?auth_error=bad_state');
    expect(await failOf(await callback('google', { ...s, oauth: '__Host-oauth=AAAA.BBBB' }))).toBe(BASE + '/start?auth_error=bad_state');
  });

  it('reused state cookie', async () => {
    const s = parseStart(await start('google'));
    nextClaims.google = claimsFor('google', { nonce: s.nonce });
    expect((await callback('google', s)).headers.get('Location')).toBe('/account');
    expect(await failOf(await callback('google', s))).toBe(BASE + '/start?auth_error=state_reused');
  });

  it('state cookie for another provider is refused', async () => {
    const s = parseStart(await start('google'));
    nextClaims.microsoft = claimsFor('microsoft', { nonce: s.nonce });
    expect(await failOf(await callback('microsoft', s))).toBe(BASE + '/start?auth_error=bad_state');
  });

  const cases = [
    ['wrong nonce', 'google', { nonce: 'wrong' }, 'nonce_mismatch'],
    ['wrong aud', 'google', { aud: 'someone-else' }, 'bad_aud'],
    ['wrong iss (google)', 'google', { iss: 'https://evil.example' }, 'bad_iss'],
    ['wrong iss (microsoft)', 'microsoft', { iss: 'https://evil.example' }, 'bad_iss'],
    ['microsoft iss not matching tid', 'microsoft', { iss: 'https://login.microsoftonline.com/99999999-2222-3333-4444-555555555555/v2.0' }, 'bad_iss'],
    ['expired token', 'google', { exp: Math.floor(Date.now() / 1000) - 3600, iat: Math.floor(Date.now() / 1000) - 7200 }, 'token_expired'],
    ['future iat', 'google', { iat: Math.floor(Date.now() / 1000) + 3600 }, 'bad_claims'],
  ];
  for (const [name, p, over, reason] of cases) {
    it(name, async () => {
      const s = parseStart(await start(p));
      nextClaims[p] = { ...claimsFor(p, { nonce: s.nonce }), ...over };
      expect(await failOf(await callback(p, s))).toBe(`${BASE}/start?auth_error=${reason}`);
      const a = await env.DB.prepare("SELECT target FROM audit_log WHERE action = 'auth.fail' AND ip = ?1 ORDER BY id DESC").bind(IP).first();
      expect(a.target).toBe(`${p}:${reason}`);
      expect(await countUsers()).toBe(0);
    });
  }

  it('token exchange failure', async () => {
    const s = parseStart(await start('google'));
    expect(await failOf(await callback('google', s))).toBe(BASE + '/start?auth_error=token_exchange');
  });
});

describe('identity linking', () => {
  it('a matching email does NOT link: same email on another provider creates a separate user', async () => {
    await socialLogin('google', { email: 'same@example.test' });
    await socialLogin('microsoft', { email: 'same@example.test', tid: '9188040d-6c67-4c5b-b112-36a304b66dad' });
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
    const locb = await bound(r); const loc = locb.loc;
    expect(loc.searchParams.get('max_age')).toBe('0');
    nextClaims.google = claimsFor('google', { nonce: loc.searchParams.get('nonce'), auth_time: t0() });
    r = await callback('google', { state: loc.searchParams.get('state'), oauth: locb.oauth, cookie: a.sid });
    expect(r.headers.get('Location')).toBe('/account');
    // now link microsoft
    r = await api('POST', '/api/account/identities/microsoft/link', a, {});
    expect(r.status).toBe(200);
    const lb = await bound(r); const l = lb.loc;
    expect(l.searchParams.get('prompt')).toBe('login');
    nextClaims.microsoft = claimsFor('microsoft', { nonce: l.searchParams.get('nonce') });
    r = await callback('microsoft', { state: l.searchParams.get('state'), oauth: lb.oauth, cookie: a.sid });
    expect(r.headers.get('Location')).toBe('/account');
    const me = await (await api('GET', '/api/me', a)).json();
    expect(me.providers.map((x) => x.provider).sort()).toEqual(['google', 'microsoft']);
    expect(await countUsers()).toBe(1);
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'identity.link' AND target = 'microsoft' AND ip = ?1").bind(IP).first()).toBeTruthy();
  });

  it('linking an identity owned by another user is refused', async () => {
    await socialLogin('microsoft', { sub: 'taken' });
    const a = await socialLogin('google');
    const r = await api('POST', '/api/account/identities/microsoft/link', a, {});
    const lb = await bound(r); const l = lb.loc;
    nextClaims.microsoft = claimsFor('microsoft', { sub: 'taken', nonce: l.searchParams.get('nonce') });
    const cb = await callback('microsoft', { state: l.searchParams.get('state'), oauth: lb.oauth, cookie: a.sid });
    expect(cb.headers.get('Location')).toBe(BASE + '/start?auth_error=identity_in_use');
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
    const exp = await (await api('POST', '/api/account/export', a)).json();
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
  it('phone: optional, normalized, encrypted, exported, and an invalid phone is a 400', async () => {
    const a = await socialLogin('google');
    const r1 = await api('POST', '/api/optouts/signup', a, { ...good, phone: '(512) 555-0100' });
    expect(r1.status).toBe(200);
    const t1 = await r1.text();
    expect(t1).not.toContain('555');
    const { id } = JSON.parse(t1);
    const p = await env.DB.prepare('SELECT payload_enc FROM pii_payloads WHERE request_id = ?1').bind(id).first();
    expect(String(p.payload_enc)).not.toContain('5125550100');
    expect((await api('POST', '/api/optouts/signup', a, good)).status).toBe(200);
    const bad = await api('POST', '/api/optouts/signup', a, { ...good, phone: '112-555-0100' });
    expect(bad.status).toBe(400);
    const bb = await bad.json();
    expect(Object.keys(bb.errors)).toEqual(['phone']);
    expect(JSON.stringify(bb)).not.toContain('555');
    const exp = await (await api('POST', '/api/account/export', a)).json();
    const phones = exp.optouts.map((o) => o.pii.phone).sort();
    expect(phones).toEqual(['+15125550100', null].sort());
    expect((await api('POST', '/api/account/delete', a)).status).toBe(200);
    expect((await env.DB.prepare('SELECT COUNT(*) AS c FROM pii_payloads').first()).c).toBe(0);
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
    expect((await api('POST', '/api/account/export', a)).status).toBe(403);
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
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'account.delete' AND ip = ?1").bind(IP).first()).toBeTruthy();
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
      await SELF.fetch(`${ACC}/oauth/google/callback?state=x&code=y`, { redirect: 'manual', headers: { 'CF-Connecting-IP': IP, 'User-Agent': long } });
      const rows = (await env.DB.prepare('SELECT action, user_id, ip, user_agent FROM audit_log WHERE ip = ?1 ORDER BY id').bind(IP).all()).results;
      expect(rows.length).toBeGreaterThan(2);
      const ok = rows.filter((r) => r.action !== 'auth.fail');
      expect(ok.length).toBeGreaterThan(0);
      expect(ok.every((r) => r.user_agent === UA)).toBe(true);
      // L2: unauthenticated auth.fail rows keep the IP but store no User-Agent
      const fails = rows.filter((r) => r.action === 'auth.fail');
      expect(fails.length).toBe(2);
      expect(fails.every((r) => r.user_id === null && r.user_agent === null)).toBe(true);
      expect(auditMeta(new Request('https://x', { headers: { 'User-Agent': long } }))[1]).toHaveLength(512);
    } finally { spies.forEach((s) => s.mockRestore()); }
    const out = logged.join('\n');
    expect(out).not.toContain(IP);
    expect(out).not.toContain('ua-marker-7f3a');
  });
  it('ip is NULL when CF-Connecting-IP is absent', async () => {
    await SELF.fetch(`${ACC}/oauth/google/callback?state=x&code=y`, { redirect: 'manual' });
    const r = await env.DB.prepare('SELECT ip FROM audit_log ORDER BY id DESC').first();
    expect(r.ip).toBeNull();
  });
});

describe('security review fixes', () => {
  const stepUpFlow = async (a, claimOver) => {
    const r = await api('POST', '/api/auth/google/stepup', a, {});
    const locb = await bound(r); const loc = locb.loc;
    nextClaims.google = { ...claimsFor('google', { nonce: loc.searchParams.get('nonce') }), ...claimOver };
    return callback('google', { state: loc.searchParams.get('state'), oauth: locb.oauth, cookie: a.sid });
  };

  it('H1: step-up/link send prompt=login + max_age=0 and require a fresh numeric auth_time', async () => {
    const a = await socialLogin('google');
    let r = await api('POST', '/api/auth/google/stepup', a, {});
    const locb = await bound(r); const loc = locb.loc;
    expect(loc.searchParams.get('prompt')).toBe('select_account'); // M-new2: Google has no prompt=login
    expect(loc.searchParams.get('max_age')).toBe('0');
    await expireStepUp();
    expect((await stepUpFlow(a, { auth_time: undefined })).headers.get('Location')).toBe(BASE + '/start?auth_error=stale_auth');
    expect((await stepUpFlow(a, { auth_time: t0() - 601 })).headers.get('Location')).toBe(BASE + '/start?auth_error=stale_auth');
    expect((await stepUpFlow(a, { auth_time: String(t0()) })).headers.get('Location')).toBe(BASE + '/start?auth_error=stale_auth');
    expect((await api('POST', '/api/account/export', a)).status).toBe(403);
    expect((await stepUpFlow(a, {})).headers.get('Location')).toBe('/account');
    // link without auth_time is refused too
    r = await api('POST', '/api/account/identities/microsoft/link', a, {});
    const lb = await bound(r); const l = lb.loc;
    nextClaims.microsoft = { ...claimsFor('microsoft', { nonce: l.searchParams.get('nonce') }), auth_time: undefined };
    r = await callback('microsoft', { state: l.searchParams.get('state'), oauth: lb.oauth, cookie: a.sid });
    expect(r.headers.get('Location')).toBe(BASE + '/start?auth_error=stale_auth');
  });

  it('Apple sign-in is removed: /api/auth/apple/* and Apple identity routes return 404', async () => {
    for (const path of ['/api/auth/apple/start', '/api/auth/apple/callback']) {
      expect((await SELF.fetch(BASE + path, { redirect: 'manual', headers: { 'CF-Connecting-IP': IP } })).status).toBe(404);
    }
    const a = await socialLogin('google');
    expect((await api('POST', '/api/auth/apple/stepup', a, {})).status).toBe(404);
    expect((await api('POST', '/api/auth/apple/callback', a, {})).status).toBe(404);
    expect((await api('POST', '/api/account/identities/apple/link', a, {})).status).toBe(404);
  });

  it('M3: bound flow refuses an idle session', async () => {
    const a = await socialLogin('google');
    const r = await api('POST', '/api/auth/google/stepup', a, {});
    const locb = await bound(r); const loc = locb.loc;
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ?1').bind(t0() - 43201).run();
    nextClaims.google = claimsFor('google', { nonce: loc.searchParams.get('nonce') });
    const cb = await callback('google', { state: loc.searchParams.get('state'), oauth: locb.oauth, cookie: a.sid });
    expect(cb.headers.get('Location')).toBe(BASE + '/start?auth_error=session_mismatch');
  });

  it('M4: export is POST only and needs CSRF', async () => {
    const a = await socialLogin('google');
    expect((await api('GET', '/api/account/export', a)).status).not.toBe(200);
    expect((await api('POST', '/api/account/export', { sid: a.sid })).status).toBe(403);
    expect((await api('POST', '/api/account/export', a)).status).toBe(200);
  });

  it('the state cookie is always SameSite=Lax (set and clear)', () => {
    expect(clearOauthCookie()).toContain('SameSite=Lax');
  });
});

describe('accounts host + handoff', () => {
  const hdrs = () => ({ 'CF-Connecting-IP': IP, 'User-Agent': UA });

  for (const p of ['google', 'microsoft']) {
    it(`${p}: full flow via accounts host and single-use handoff`, async () => {
      const s = parseStart(await start(p));
      expect(s.loc.searchParams.get('redirect_uri')).toBe(`${ACC}/oauth/${p}/callback`);
      expect(s.oauth).toBeTruthy();
      nextClaims[p] = claimsFor(p, { nonce: s.nonce });
      const res = await callback(p, s);
      // accounts host never sets the session cookie; it hands off with a code and clears the state cookie
      expect(res.first.status).toBe(302);
      expect(setCookies(res.first).some((c) => c.startsWith('__Host-sid='))).toBe(false);
      expect(res.first.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(res.headers.get('Location')).toBe('/account');
      const sc = setCookies(res).find((c) => c.startsWith('__Host-sid='));
      expect(sc).toBeTruthy();
      expect(sc).not.toMatch(/Domain=/i);
      const code = new URL(lastHandoff).searchParams.get('code');
      const row = await env.DB.prepare('SELECT * FROM auth_handoffs').first();
      expect(JSON.stringify(row)).not.toContain(code); // only the hash is stored
      expect(row.expires_at - row.auth_at).toBe(60);
      // reuse is refused
      const again = await SELF.fetch(lastHandoff, { redirect: 'manual', headers: hdrs() });
      expect(again.headers.get('Location')).toBe('/start?auth_error=handoff_reused');
      expect(cookieVal(again, '__Host-sid')).toBeNull();
    });
  }

  it('expired, tampered and malformed codes are refused and audited', async () => {
    const s = parseStart(await start('google'));
    nextClaims.google = claimsFor('google', { nonce: s.nonce });
    const first = await SELF.fetch(`${ACC}/oauth/google/callback?state=${encodeURIComponent(s.state)}&code=x`, { redirect: 'manual', headers: { ...hdrs(), Cookie: s.oauth } });
    const link = first.headers.get('Location');
    const code = new URL(link).searchParams.get('code');
    const tampered = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A');
    let r = await SELF.fetch(`${BASE}/api/auth/complete?code=${tampered}`, { redirect: 'manual', headers: hdrs() });
    expect(r.headers.get('Location')).toBe('/start?auth_error=handoff_invalid');
    r = await SELF.fetch(`${BASE}/api/auth/complete?code=..`, { redirect: 'manual', headers: hdrs() });
    expect(r.headers.get('Location')).toBe('/start?auth_error=handoff_invalid');
    await env.DB.prepare('UPDATE auth_handoffs SET expires_at = ?1').bind(t0() - 1).run();
    r = await SELF.fetch(link, { redirect: 'manual', headers: hdrs() });
    expect(r.headers.get('Location')).toBe('/start?auth_error=handoff_expired');
    expect(cookieVal(r, '__Host-sid')).toBeNull();
    const fails = (await env.DB.prepare("SELECT target FROM audit_log WHERE action = 'auth.fail' AND ip = ?1").bind(IP).all()).results.map((x) => x.target);
    expect(fails).toEqual(expect.arrayContaining(['handoff:handoff_invalid', 'handoff:handoff_expired']));
  });

  it('handoff redemption is rate-limited', async () => {
    for (let i = 0; i < 30; i++) await SELF.fetch(`${BASE}/api/auth/complete?code=x`, { redirect: 'manual', headers: hdrs() });
    expect((await SELF.fetch(`${BASE}/api/auth/complete?code=x`, { redirect: 'manual', headers: hdrs() })).status).toBe(429);
  });

  it('open redirect on return_to is neutralised end to end', async () => {
    for (const bad of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
      const s = parseStart(await start('google', bad));
      nextClaims.google = claimsFor('google', { nonce: s.nonce });
      expect((await callback('google', s)).headers.get('Location')).toBe('/start');
    }
    const s = parseStart(await start('google', 'https://evil.example'));
    nextClaims.google = claimsFor('google', { nonce: s.nonce });
    const res = await callback('google', s);
    expect(res.headers.get('Location')).toBe('/start');
  });

  it('wrong host: accounts routes are 404 on the apex, apex routes are 404 on accounts, old apex callbacks are gone', async () => {
    for (const path of ['/signin', '/oauth/google/start', '/oauth/google/callback']) {
      expect((await SELF.fetch(BASE + path, { redirect: 'manual', headers: hdrs() })).status).toBe(404);
    }
    for (const path of ['/api/auth/complete?code=x', '/api/me', '/api/auth/google/start', '/account']) {
      expect((await SELF.fetch(ACC + path, { redirect: 'manual', headers: hdrs() })).status).toBe(404);
    }
    for (const p of ['google', 'microsoft']) {
      expect((await SELF.fetch(`${BASE}/api/auth/${p}/callback?state=x&code=y`, { redirect: 'manual', headers: hdrs() })).status).toBe(404);
    }
  });

  it('accounts host: origin allowlist, GET only', async () => {
    expect((await SELF.fetch(`${ACC}/signin`, { headers: { ...hdrs(), Origin: 'https://evil.example' } })).status).toBe(403);
    expect((await SELF.fetch(`${ACC}/signin`, { headers: { ...hdrs(), Origin: BASE } })).status).toBe(403);
    expect((await SELF.fetch(`${ACC}/signin`, { headers: { ...hdrs(), Origin: ACC } })).status).toBe(200);
    expect((await SELF.fetch(`${ACC}/oauth/google/callback`, { method: 'POST', headers: { ...hdrs(), Origin: ACC } })).status).toBe(405);
    expect((await SELF.fetch(`${ACC}/oauth/google/start`, { method: 'POST', headers: { ...hdrs(), Origin: ACC } })).status).toBe(405);
    expect((await SELF.fetch(`${ACC}/oauth/google/bound`, { headers: hdrs() })).status).toBe(405);
    // the accounts origin is not an API origin
    expect((await SELF.fetch(`${BASE}/api/me`, { headers: { ...hdrs(), Origin: ACC } })).status).toBe(403);
  });

  it('sign-in page: two providers, password fallback, strict security headers, no scripts', async () => {
    const r = await SELF.fetch(`${ACC}/signin?return_to=%2Faccount`, { headers: hdrs() });
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('DROP Texas');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('Continue with Microsoft');
    expect(html).not.toMatch(/oauth\/apple|with apple/i);
    expect(html).toContain(`${BASE}/account`);
    expect(html).not.toMatch(/<script/i);
    const csp = r.headers.get('Content-Security-Policy');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'none'");
    const nonce = csp.match(/'nonce-([^']+)'/)[1];
    expect(html).toContain(`<style nonce="${nonce}">`);
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('step-up start token is POSTed, single use, provider-bound, origin-checked and tamper-evident; step-up applies only to the same session', async () => {
    const a = await socialLogin('google');
    await expireStepUp();
    const res = await api('POST', '/api/auth/google/stepup', a, {});
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    const body = await res.json();
    browser = cookieVal(res, '__Host-login');
    expect(body.action).toBe(`${ACC}/oauth/google/bound`);
    expect(body.action).not.toContain('?');
    const tok = body.fields.st;
    // wrong origin / GET start with a bound token are refused without consuming it
    expect((await postForm(body.action, { st: tok }, 'https://evil.example')).status).toBe(403);
    const asGet = await SELF.fetch(`${ACC}/oauth/google/start?st=${encodeURIComponent(tok)}`, { redirect: 'manual', headers: hdrs() });
    expect(asGet.headers.get('Location')).toBe(`${BASE}/start?auth_error=bad_start`);
    const swapped = await postForm(`${ACC}/oauth/microsoft/bound`, { st: tok });
    expect(swapped.headers.get('Location')).toBe(`${BASE}/start?auth_error=bad_start`);
    const bad = await postForm(body.action, { st: tok.slice(0, -2) + 'AA' });
    expect(bad.headers.get('Location')).toBe(`${BASE}/start?auth_error=bad_start`);
    const first = await postForm(body.action, { st: tok });
    expect(first.status).toBe(302);
    const again = await postForm(body.action, { st: tok });
    expect(again.headers.get('Location')).toBe(`${BASE}/start?auth_error=start_reused`);
    // complete the provider round trip, but redeem without the apex session: refused, no step-up
    const loc = new URL(first.headers.get('Location'));
    expect(loc.searchParams.get('prompt')).toBe('select_account');
    expect(loc.searchParams.get('max_age')).toBe('0');
    nextClaims.google = claimsFor('google', { nonce: loc.searchParams.get('nonce') });
    const r = await callback('google', { state: loc.searchParams.get('state'), oauth: cookieVal(first, '__Host-oauth') });
    expect(r.headers.get('Location')).toBe('/start?auth_error=session_mismatch');
    expect((await api('POST', '/api/account/export', a)).status).toBe(403);
  });
});

describe('browser binding (B1) and deferred link (H-new1)', () => {
  const hdrs = () => ({ 'CF-Connecting-IP': IP, 'User-Agent': UA });
  const failRes = (r, reason) => {
    expect(r.headers.get('Location')).toBe(`/start?auth_error=${reason}`);
    expect(cookieVal(r, '__Host-sid')).toBeNull();
    expect(setCookies(r).some((c) => c.startsWith('__Host-login=;') && c.includes('Max-Age=0'))).toBe(true);
  };

  it('apex start sets a host-only __Host-login cookie and sends only a sealed start token', async () => {
    const r = await SELF.fetch(`${BASE}/api/auth/google/start?return_to=%2Faccount`, { redirect: 'manual', headers: hdrs() });
    const c = setCookies(r).find((x) => x.startsWith('__Host-login='));
    for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=600']) expect(c).toContain(a);
    expect(c).not.toMatch(/Domain=/i);
    const loc = new URL(r.headers.get('Location'));
    expect(loc.origin + loc.pathname).toBe(`${ACC}/oauth/google/start`);
    expect([...loc.searchParams.keys()]).toEqual(['st']);
    expect(loc.toString()).not.toContain(c.split(';')[0].split('=')[1]); // the raw cookie never leaves the apex
    expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('direct /oauth/{p}/start without a valid start token is refused', async () => {
    for (const q of ['', '?return_to=%2Faccount', '?st=garbage']) {
      const r = await SELF.fetch(`${ACC}/oauth/google/start${q}`, { redirect: 'manual', headers: hdrs() });
      expect(r.headers.get('Location')).toBe(`${BASE}/start?auth_error=bad_start`);
      expect(cookieVal(r, '__Host-oauth')).toBeNull();
    }
    // a login start token is single use
    const a = await SELF.fetch(`${BASE}/api/auth/google/start`, { redirect: 'manual', headers: hdrs() });
    const url = a.headers.get('Location');
    expect((await SELF.fetch(url, { redirect: 'manual', headers: hdrs() })).status).toBe(302);
    expect((await SELF.fetch(url, { redirect: 'manual', headers: hdrs() })).headers.get('Location')).toBe(`${BASE}/start?auth_error=start_reused`);
  });

  it('HEAD /oauth/{p}/start is 405 and consumes neither the token nor the rate limit', async () => {
    const a = await SELF.fetch(`${BASE}/api/auth/google/start`, { redirect: 'manual', headers: hdrs() });
    const url = a.headers.get('Location');
    for (let i = 0; i < 35; i++) expect((await SELF.fetch(url, { method: 'HEAD', redirect: 'manual', headers: hdrs() })).status).toBe(405);
    expect((await SELF.fetch(url, { redirect: 'manual', headers: hdrs() })).status).toBe(302);
  });

  it('redeeming without the __Host-login cookie is refused, audited, and does not burn the code', async () => {
    const s = parseStart(await start('google'));
    nextClaims.google = claimsFor('google', { nonce: s.nonce });
    const r = await callback('google', { ...s, login: null });
    failRes(r, 'browser_mismatch');
    expect(await countUsers()).toBe(1); // user exists (provider auth happened) but no session was issued
    expect(await env.DB.prepare('SELECT COUNT(*) AS c FROM sessions').first()).toEqual({ c: 0 });
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'auth.fail' AND target = 'handoff:browser_mismatch' AND ip = ?1").bind(IP).first()).toBeTruthy();
  });

  it('login CSRF: an attacker handoff redeemed in a victim browser with a different __Host-login is refused', async () => {
    const s = parseStart(await start('google')); // attacker's own flow + cookie
    nextClaims.google = claimsFor('google', { nonce: s.nonce });
    const victim = cookieVal(await SELF.fetch(`${BASE}/api/auth/google/start`, { redirect: 'manual', headers: hdrs() }), '__Host-login');
    const r = await callback('google', { ...s, login: victim });
    failRes(r, 'browser_mismatch');
    const s2 = parseStart(await start('google'));
    nextClaims.google = claimsFor('google', { nonce: s2.nonce });
    const wrong = await callback('google', { ...s2, login: '__Host-login=' + 'A'.repeat(43) });
    failRes(wrong, 'browser_mismatch');
  });

  it('a successful redemption clears __Host-login', async () => {
    const { res } = await socialLogin('microsoft');
    expect(cookieVal(res, '__Host-sid')).toBeTruthy();
    expect(setCookies(res).some((c) => c.startsWith('__Host-login=;') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('link: the callback only stages the identity; nothing is linked or audited until complete() matches session + browser', async () => {
    const a = await socialLogin('google');
    const lb = await bound(await api('POST', '/api/account/identities/microsoft/link', a, {}));
    nextClaims.microsoft = claimsFor('microsoft', { sub: 'staged-sub', nonce: lb.loc.searchParams.get('nonce') });
    const cb = await SELF.fetch(`${ACC}/oauth/microsoft/callback?state=${encodeURIComponent(lb.state)}&code=x`,
      { redirect: 'manual', headers: { ...hdrs(), Cookie: lb.oauth } });
    expect(cb.headers.get('Location').startsWith(`${BASE}/api/auth/complete?code=`)).toBe(true);
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM user_identities WHERE provider = 'microsoft'").first()).toEqual({ c: 0 });
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'identity.link' AND ip = ?1").bind(IP).first()).toBeNull();
    const row = await env.DB.prepare("SELECT * FROM auth_handoffs WHERE intent = 'link'").first();
    expect(row.link_sub).toContain('staged-sub');
    expect(row.link_email).not.toContain('@example.test');
    // same browser + session -> linked now
    const done = await SELF.fetch(cb.headers.get('Location'), { redirect: 'manual', headers: { ...hdrs(), Cookie: `${a.sid}; ${browser}` } });
    expect(done.headers.get('Location')).toBe('/account');
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM user_identities WHERE provider = 'microsoft' AND sub LIKE '%staged-sub'").first()).toEqual({ c: 1 });
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'identity.link' AND ip = ?1").bind(IP).first()).toBeTruthy();
  });

  it('a leaked link start token used from another browser/session links nothing', async () => {
    const victim = await socialLogin('google');
    const res = await api('POST', '/api/account/identities/microsoft/link', victim, {});
    const { action, fields } = await res.json(); // token leaks; the victim's __Host-login does not
    const attacker = await socialLogin('microsoft', { sub: 'attacker-ms', tid: '9188040d-6c67-4c5b-b112-36a304b66dad' });
    await env.DB.prepare('DELETE FROM user_identities WHERE sub LIKE ?1').bind('%attacker-ms').run();
    const first = await postForm(action, fields);
    const loc = new URL(first.headers.get('Location'));
    nextClaims.microsoft = claimsFor('microsoft', { sub: 'attacker-ms', nonce: loc.searchParams.get('nonce') });
    const attackerLogin = browser; // the attacker's own __Host-login (from their own sign-in)
    const cb = await SELF.fetch(`${ACC}/oauth/microsoft/callback?state=${encodeURIComponent(loc.searchParams.get('state'))}&code=x`,
      { redirect: 'manual', headers: { ...hdrs(), Cookie: cookieVal(first, '__Host-oauth') } });
    const handoff = cb.headers.get('Location');
    expect(handoff.startsWith(`${BASE}/api/auth/complete?code=`)).toBe(true);
    // the attacker cannot present the victim's __Host-login, whatever session cookie they use
    for (const jar of [attacker.sid, `${attacker.sid}; ${attackerLogin}`, victim.sid, '']) {
      const r = await SELF.fetch(handoff, { redirect: 'manual', headers: { ...hdrs(), ...(jar ? { Cookie: jar } : {}) } });
      expect(r.headers.get('Location')).toBe('/start?auth_error=browser_mismatch');
    }
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM user_identities WHERE sub LIKE '%attacker-ms'").first()).toEqual({ c: 0 });
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'identity.link' AND ip = ?1").bind(IP).first()).toBeNull();
  });
});
