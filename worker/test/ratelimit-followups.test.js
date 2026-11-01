// Review follow-ups for PR #23: rejected opt-out writes count, refunds on TOTP / step-up / bootstrap, and refunds
// never carry into the next fixed window.
import { env, SELF } from 'cloudflare:test';
// Each opt-out case makes 30+ requests and hashes passwords; allow for a loaded full-suite run.
const SLOW = 30_000;
import { describe, it, expect, beforeEach } from 'vitest';
import { authenticator } from 'otplib';
import { hashPassword, encryptStr } from '../src/crypto.js';
import { reserve, refund, LIMITS } from '../src/ratelimit.js';

const ORIGIN = 'http://localhost:5173';
const BASE = 'https://api.test';
let IP; let n = 0;

beforeEach(async () => {
  IP = `10.77.${Math.floor(++n / 250)}.${n % 250}`;
  await env.DB.batch(['user_identities', 'confirmations', 'pii_payloads', 'optout_requests', 'profiles', 'backup_codes', 'sessions', 'users', 'rate_limits']
    .map((t) => env.DB.prepare(`DELETE FROM ${t}`))); // test-only fixed table names
});

const req = (method, path, body, headers = {}) => SELF.fetch(BASE + path, {
  method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': IP, ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const cookieOf = (r) => r.headers.getSetCookie().find((c) => c.startsWith('__Host-sid=')).split(';')[0];

async function makeUser(password = 'correct horse battery') {
  const id = crypto.randomUUID();
  const email = `fu-${id}@example.test`;
  const secret = authenticator.generateSecret(20);
  await env.DB.prepare('INSERT INTO users (id, email, pw_hash, totp_secret_enc, totp_enabled, created_at) VALUES (?1, ?2, ?3, ?4, 1, 1)')
    .bind(id, email, await hashPassword(password), await encryptStr(env, secret)).run();
  return { id, email, password, secret };
}
const resetStep = (u) => env.DB.prepare('UPDATE users SET totp_last_step = NULL WHERE id = ?1').bind(u.id).run(); // test-only: reuse current TOTP step
async function fullLogin(u) {
  const r1 = await req('POST', '/auth/login', { email: u.email, password: u.password });
  expect(r1.status).toBe(200);
  const { preauth_token } = await r1.json();
  const r = await req('POST', '/auth/totp/verify', { preauth_token, code: authenticator.generate(u.secret) });
  expect(r.status).toBe(200);
  return { Cookie: cookieOf(r), 'X-CSRF-Token': (await r.json()).csrf_token };
}

describe('rejected opt-out writes count against the optout limit (30/hour per user)', () => {
  const max = LIMITS.optout.max;
  const cases = {
    'create (400 bad status)': (h) => req('POST', '/optouts', { status: 'bogus' }, h),
    'create (400 unknown broker)': (h) => req('POST', '/optouts', { broker_id: 'no-such-broker' }, h),
    'patch (404 unknown id)': (h) => req('PATCH', `/optouts/${crypto.randomUUID()}`, { notes: 'x' }, h),
    'patch (400 bad body)': async (h) => {
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO optout_requests (id, user_id, broker_id, status, created_at, updated_at, kind) VALUES (?1, (SELECT user_id FROM sessions LIMIT 1), NULL, 'queued', 1, 1, 'optout')").bind(id).run();
      return req('PATCH', `/optouts/${id}`, { deadline: -1 }, h);
    },
    'signup (400 invalid body)': (h) => req('POST', '/api/optouts/signup', [], h),
  };
  for (const [name, call] of Object.entries(cases)) {
    it(`${name}: ${max} rejections, then 429 with Retry-After`, async () => {
      const u = await makeUser();
      const h = await fullLogin(u);
      const expected = name.startsWith('patch (404') ? 404 : 400;
      for (let i = 0; i < max; i++) expect((await call(h)).status).toBe(expected);
      const r = await call(h);
      expect(r.status).toBe(429);
      expect(Number(r.headers.get('Retry-After'))).toBeGreaterThan(0);
      // A valid write is now refused too: the limit is per user, shared by create/patch/signup.
      expect((await req('POST', '/optouts', {}, h)).status).toBe(429);
    }, SLOW);
  }
  it('rejections on create, patch and signup share one per-user counter', async () => {
    const u = await makeUser();
    const h = await fullLogin(u);
    for (let i = 0; i < max; i++) {
      const r = await [cases['create (400 bad status)'], cases['patch (404 unknown id)'], cases['signup (400 invalid body)']][i % 3](h);
      expect([400, 404]).toContain(r.status);
    }
    expect((await cases['signup (400 invalid body)'](h)).status).toBe(429);
    // Another user is unaffected.
    const h2 = await fullLogin(await makeUser());
    expect((await req('POST', '/optouts', {}, h2)).status).toBe(201);
  }, SLOW);
});

describe('credential refunds on success', () => {
  it('TOTP: a successful verification is refunded', async () => {
    const u = await makeUser();
    // 4 failed logins (count 4); successful login reserves 5 then refunds to 4; successful TOTP reserves 5 then refunds to 4.
    for (let i = 0; i < 4; i++) expect((await req('POST', '/auth/login', { email: u.email, password: 'wrong' })).status).toBe(401);
    const r1 = await req('POST', '/auth/login', { email: u.email, password: u.password });
    const { preauth_token } = await r1.json();
    expect((await req('POST', '/auth/totp/verify', { preauth_token, code: authenticator.generate(u.secret) })).status).toBe(200);
    // Without the TOTP refund the counter would be at 5 and this would be 429.
    expect((await req('POST', '/auth/login', { email: u.email, password: 'wrong' })).status).toBe(401);
    expect((await req('POST', '/auth/login', { email: u.email, password: 'wrong' })).status).toBe(429);
  }, SLOW);

  it('step-up: a successful password+TOTP step-up is refunded', async () => {
    const u = await makeUser();
    const h = await fullLogin(u);
    const stepUp = (body) => req('POST', '/api/auth/stepup/password', body, h);
    for (let i = 0; i < 4; i++) expect((await stepUp({ password: 'wrong', code: '000000' })).status).toBe(401);
    await resetStep(u);
    expect((await stepUp({ password: u.password, code: authenticator.generate(u.secret) })).status).toBe(200);
    expect((await stepUp({ password: 'wrong', code: '000000' })).status).toBe(401); // 5th failure still allowed
    expect((await stepUp({ password: 'wrong', code: '000000' })).status).toBe(429);
  }, SLOW);

  it('bootstrap: a correct token is refunded, wrong tokens count', async () => {
    await makeUser(); // users exist, so a correct token still ends in 404 (self-disabled) but after the refund
    const boot = (token) => req('POST', '/admin/bootstrap', {}, { Authorization: `Bearer ${token}` });
    for (let i = 0; i < 8; i++) expect((await boot(env.ADMIN_BOOTSTRAP_TOKEN)).status).toBe(404);
    for (let i = 0; i < 5; i++) expect((await boot('wrong-token')).status).toBe(404);
    expect((await boot('wrong-token')).status).toBe(429);
  }, SLOW);
});

describe('fixed windows', () => {
  it('a refund in window N does not carry into window N+1', async () => {
    const id = `192.0.2.5|${crypto.randomUUID()}`;
    const w = LIMITS.login.windowSec;
    const t0 = Math.floor(1_900_000_000 / w) * w;
    // Window N: 5 reservations, one of them refunded late (after the window ended).
    const rs = [];
    for (let i = 1; i <= 5; i++) rs.push(await reserve(env, 'login', id, t0 + i));
    // Window N+1: fill it to the limit.
    for (let i = 0; i < LIMITS.login.max; i++) expect((await reserve(env, 'login', id, t0 + w + i)).limited).toBe(0);
    await refund(env, rs[0]); // refunds window N's row only
    expect((await reserve(env, 'login', id, t0 + w + 10)).limited).toBeGreaterThan(0);
    const rows = (await env.DB.prepare('SELECT window_start, count FROM rate_limits WHERE window_start IN (?1, ?2) ORDER BY window_start').bind(t0, t0 + w).all()).results;
    expect(rows).toEqual([{ window_start: t0, count: 4 }, { window_start: t0 + w, count: LIMITS.login.max + 1 }]);
    // And a refund never goes below zero.
    const one = await reserve(env, 'login', `${id}|z`, t0);
    await refund(env, one); await refund(env, one);
    expect((await env.DB.prepare('SELECT count FROM rate_limits WHERE key = ?1 AND window_start = ?2').bind(one.key, one.start).first()).count).toBe(0);
  });
});
