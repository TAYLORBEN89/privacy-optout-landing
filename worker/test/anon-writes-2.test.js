// Anonymous writes, part 2: confirmations, /profile, /api/account/*, /api/optouts/signup, the /auth/* session writes
// (and their /api aliases) and the legacy KV routes (/records, /txrequests, /settings). Every anonymous variant gets
// the uniform 401 and nothing is written: D1 row counts and the opt-out/profile/user rows are unchanged, and the KV
// key list is unchanged. Valid sessions (and the legacy bearer token) are the controls.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { authenticator } from 'otplib';
import { hashPassword, encryptStr } from '../src/crypto.js';

const ORIGIN = 'http://localhost:5173';
let IP; let n = 0;
async function makeUser(email) {
  const id = crypto.randomUUID(); const secret = authenticator.generateSecret(20); const password = 'correct horse battery';
  await env.DB.prepare('INSERT INTO users (id, email, pw_hash, totp_secret_enc, totp_enabled, created_at) VALUES (?1, ?2, ?3, ?4, 1, 1)')
    .bind(id, email, await hashPassword(password), await encryptStr(env, secret)).run();
  return { id, email, password, secret };
}
const req = (method, path, body, headers = {}) => SELF.fetch('https://api.test' + path, {
  method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': IP, ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
async function login(u) {
  const pre = (await (await req('POST', '/auth/login', { email: u.email, password: u.password })).json()).preauth_token;
  const r = await req('POST', '/auth/totp/verify', { preauth_token: pre, code: authenticator.generate(u.secret) });
  return { Cookie: (r.headers.get('Set-Cookie') || '').split(';')[0], 'X-CSRF-Token': (await r.json()).csrf_token };
}

const TABLES = ['users', 'sessions', 'optout_requests', 'pii_payloads', 'confirmations', 'profiles', 'backup_codes', 'user_identities'];
async function snapshot() {
  const counts = {};
  for (const t of TABLES) counts[t] = (await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${t}`).first()).c;
  const opt = (await env.DB.prepare('SELECT * FROM optout_requests ORDER BY id').all()).results;
  const prof = (await env.DB.prepare('SELECT * FROM profiles ORDER BY user_id').all()).results;
  const users = (await env.DB.prepare('SELECT id, pw_hash, totp_enabled, totp_secret_enc, totp_pending_enc FROM users ORDER BY id').all()).results;
  const live = (await env.DB.prepare('SELECT COUNT(*) AS c FROM sessions WHERE revoked = 0').first()).c;
  const kv = (await env.RECORDS.list()).keys.map((k) => k.name).sort();
  return { counts, opt, prof, users, live, kv };
}

beforeEach(async () => {
  IP = `10.78.0.${++n}`;
  await env.DB.batch(['confirmations', 'pii_payloads', 'optout_requests', 'profiles', 'backup_codes', 'user_identities', 'sessions', 'users']
    .map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  await env.DB.prepare("INSERT OR IGNORE INTO brokers (id, name, url, category) VALUES ('spokeo', 'Spokeo', 'https://spokeo.com', 'people')").run();
  for (const k of (await env.RECORDS.list()).keys) await env.RECORDS.delete(k.name);
});

const SIGNUP = { kind: 'self', firstName: 'Test', lastName: 'Person', email: 'person@example.test', dob: '1990-01-01', state: 'TX' };
const writes = (optId) => [
  ['POST', `/optouts/${optId}/confirmations`, { confirmation_no: 'TEST-0002', channel: 'email' }],
  ['PUT', '/profile', { full_name: 'Test Person' }],
  ['PUT', '/api/profile', { full_name: 'Test Person' }],
  ['PATCH', '/api/account/profile', { display_name: 'x' }],
  ['POST', '/api/account/sessions/0123456789abcdef/revoke', {}],
  ['POST', '/api/account/export', {}],
  ['POST', '/api/account/delete', {}],
  ['POST', '/api/account/identities/google/link', { return_to: '/account' }],
  ['DELETE', '/api/account/identities/google', undefined],
  ['POST', '/api/optouts/signup', SIGNUP],
  ['POST', '/auth/logout', {}], ['POST', '/api/auth/logout', {}],
  ['POST', '/auth/refresh', {}], ['POST', '/api/auth/refresh', {}],
  ['POST', '/auth/totp/enroll', {}], ['POST', '/api/auth/totp/enroll', {}],
  ['POST', '/auth/totp/confirm', { code: '123456' }], ['POST', '/api/auth/totp/confirm', { code: '123456' }],
  ['POST', '/auth/backup-codes/regenerate', {}], ['POST', '/api/auth/backup-codes/regenerate', {}],
  ['POST', '/api/auth/stepup/password', { password: 'correct horse battery', code: '123456' }],
  ['POST', '/api/auth/google/stepup', { return_to: '/account' }],
  ['POST', '/api/auth/mfa/verify', { code: '123456' }],
];
const LEGACY = [
  ['POST', '/records', { id: 'r1', name: 'x' }], ['PUT', '/records/r1', { name: 'x' }], ['DELETE', '/records/seeded', undefined],
  ['POST', '/txrequests', { id: 't1' }], ['PUT', '/txrequests/t1', { status: 'sent' }], ['DELETE', '/txrequests/seeded', undefined],
  ['PUT', '/settings/profile', { name: 'x' }],
];

describe('anonymous writes (part 2) get the uniform 401 and write nothing', () => {
  // One test per variant (each builds its own fixtures) with a generous timeout: the full suite runs workers in
  // parallel, and ~23 requests per variant can pass 30 s on a loaded machine.
  async function fixture() {
    const u = await makeUser('owner@example.test');
    const h = await login(u);
    const c = await req('POST', '/optouts', { broker_id: 'spokeo' }, h);
    expect(c.status).toBe(201); // control: a valid session writes
    const optId = (await c.json()).id;
    expect((await req('POST', `/optouts/${optId}/confirmations`, { confirmation_no: 'TEST-0001', channel: 'email' }, h)).status).toBe(201);
    return { u, h, optId, cookieName: h.Cookie.split('=')[0] };
  }
  async function check(label, headers, optId, { expiredOnUse = false } = {}) {
    const before = await snapshot();
    for (const [m, path, body] of writes(optId)) {
      const r = await req(m, path, body, headers);
      expect(r.status, `${label}: ${m} ${path}`).toBe(401);
      expect(await r.json(), `${label}: ${m} ${path}`).toEqual({ error: 'unauthorized' });
    }
    const after = await snapshot();
    if (expiredOnUse) { expect(after.live).toBe(before.live - 1); after.live = before.live; } // expired session is revoked on use
    expect(after, label).toEqual(before);
  }
  const T = 120_000;
  it('session routes: no cookie (with and without a CSRF header)', async () => {
    const { h, optId } = await fixture();
    await check('no cookie', {}, optId);
    await check('no cookie + csrf', { 'X-CSRF-Token': h['X-CSRF-Token'] }, optId);
  }, T);
  it('session routes: garbage cookie', async () => {
    const { h, optId, cookieName } = await fixture();
    await check('garbage cookie', { Cookie: `${cookieName}=not-a-real-session-token`, 'X-CSRF-Token': h['X-CSRF-Token'] }, optId);
  }, T);
  it('session routes: expired session', async () => {
    const { u, h, optId } = await fixture();
    await env.DB.prepare('UPDATE sessions SET expires_at = 1 WHERE user_id = ?1').bind(u.id).run();
    await check('expired session', h, optId, { expiredOnUse: true });
  }, T);
  it('session routes: revoked session', async () => {
    const { u, h, optId } = await fixture();
    await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?1').bind(u.id).run();
    await check('revoked session', h, optId);
  }, T);

  it('legacy KV routes: no token, garbage token, a session cookie alone -> 401, KV unchanged; the bearer token works', async () => {
    const BEARER = { Authorization: 'Bearer test-legacy-token' };
    expect((await req('POST', '/records', { id: 'seeded', name: 'x' }, BEARER)).status).toBeLessThan(300); // control
    expect((await req('POST', '/txrequests', { id: 'seeded' }, BEARER)).status).toBeLessThan(300);
    const u = await makeUser('owner@example.test');
    const h = await login(u);
    for (const [label, headers] of [['no token', {}], ['garbage token', { Authorization: 'Bearer not-the-token-xxxxx' }],
      ['wrong-length token', { Authorization: 'Bearer x' }], ['session cookie only', h]]) {
      const before = await snapshot();
      for (const [m, path, body] of LEGACY) {
        const r = await req(m, path, body, headers);
        expect(r.status, `${label}: ${m} ${path}`).toBe(401);
        expect(await r.json(), `${label}: ${m} ${path}`).toEqual({ error: 'unauthorized' });
      }
      expect(await snapshot(), label).toEqual(before);
    }
  }, 120_000);
});
