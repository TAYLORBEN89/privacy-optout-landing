import { env, SELF, createScheduledController, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { authenticator } from 'otplib';
import worker from '../src/index.js';
import { hashPassword, encryptStr } from '../src/crypto.js';

const ORIGIN = 'http://localhost:5173';
const BASE = 'https://api.test';
let ipCounter = 0;
let IP;

async function makeUser({ email = 'owner@example.test', password = 'correct horse battery', totp = true } = {}) {
  const id = crypto.randomUUID();
  const secret = authenticator.generateSecret(20);
  await env.DB.prepare('INSERT INTO users (id, email, pw_hash, totp_secret_enc, totp_enabled, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(id, email, await hashPassword(password), totp ? await encryptStr(env, secret) : null, totp ? 1 : 0, 1).run();
  return { id, email, password, secret };
}

const post = (path, body, headers = {}) => SELF.fetch(BASE + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': IP, ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const get = (path, headers = {}) => SELF.fetch(BASE + path, { headers: { Origin: ORIGIN, 'CF-Connecting-IP': IP, ...headers } });
const cookieOf = (res) => (res.headers.get('Set-Cookie') || '').split(';')[0];

async function fullLogin(u) {
  const r1 = await post('/auth/login', { email: u.email, password: u.password });
  const { preauth_token } = await r1.json();
  const r2 = await post('/auth/totp/verify', { preauth_token, code: authenticator.generate(u.secret) });
  expect(r2.status).toBe(200);
  const { csrf_token } = await r2.json();
  return { cookie: cookieOf(r2), csrf: csrf_token, res: r2 };
}

beforeEach(async () => {
  IP = `10.0.0.${++ipCounter}`;
  await env.DB.batch(['audit_log', 'confirmations', 'pii_payloads', 'optout_requests', 'sessions', 'users']
    .map((t) => env.DB.prepare(`DELETE FROM ${t}`))); // test-only fixed table names
  await env.DB.prepare("INSERT OR IGNORE INTO brokers (id, name) VALUES ('b', 'B'), ('x', 'X'), ('spokeo', 'Spokeo')").run();
});

describe('login', () => {
  it('succeeds and returns a pre-auth token when TOTP enabled', async () => {
    const u = await makeUser();
    const r = await post('/auth/login', { email: u.email, password: u.password });
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.mfa_required).toBe(true);
    expect(b.preauth_token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(r.headers.get('Set-Cookie')).toBeNull();
  });

  it('wrong password, unknown user, and malformed body give identical 401 responses', async () => {
    const u = await makeUser();
    const responses = [
      await post('/auth/login', { email: u.email, password: 'wrong' }),
      await post('/auth/login', { email: 'nobody@example.test', password: 'wrong' }),
      await post('/auth/login', { email: u.email }),
      await post('/auth/login', 'garbage'),
    ];
    for (const r of responses) {
      expect(r.status).toBe(401);
      expect(await r.text()).toBe('{"error":"invalid credentials"}');
    }
  });

  it('stores only the SHA-256 hash of session tokens and sets a hardened cookie', async () => {
    const u = await makeUser();
    const { cookie, res } = await fullLogin(u);
    const sc = res.headers.get('Set-Cookie');
    expect(sc).toMatch(/^__Host-sid=/);
    expect(sc).not.toMatch(/Domain=/i);
    expect(sc).not.toContain('Partitioned');
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(sc).toContain(attr);
    const raw = cookie.split('=')[1];
    const rows = (await env.DB.prepare("SELECT id_hash FROM sessions WHERE stage = 'session'").all()).results;
    expect(rows.some((r) => r.id_hash === raw)).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.id_hash))).toBe(true);
  });
});

describe('TOTP', () => {
  it('rejects replay of the same code', async () => {
    const u = await makeUser();
    const code = authenticator.generate(u.secret);
    const p1 = (await (await post('/auth/login', { email: u.email, password: u.password })).json()).preauth_token;
    expect((await post('/auth/totp/verify', { preauth_token: p1, code })).status).toBe(200);
    const p2 = (await (await post('/auth/login', { email: u.email, password: u.password })).json()).preauth_token;
    const r = await post('/auth/totp/verify', { preauth_token: p2, code });
    expect(r.status).toBe(401);
    expect(await r.text()).toBe('{"error":"invalid credentials"}');
  });

  it('pre-auth token is single-use', async () => {
    const u = await makeUser();
    const p = (await (await post('/auth/login', { email: u.email, password: u.password })).json()).preauth_token;
    expect((await post('/auth/totp/verify', { preauth_token: p, code: authenticator.generate(u.secret) })).status).toBe(200);
    expect((await post('/auth/totp/verify', { preauth_token: p, code: '000000' })).status).toBe(401);
  });

  it('enroll + confirm upgrades a password-only session and rotates the token', async () => {
    const u = await makeUser({ totp: false });
    const r1 = await post('/auth/login', { email: u.email, password: u.password });
    const b1 = await r1.json();
    expect(b1.totp_enrollment_required).toBe(true);
    const cookie = cookieOf(r1);
    // password-only session cannot use the opt-out API
    expect((await get('/optouts', { Cookie: cookie })).status).toBe(403);
    const en = await post('/auth/totp/enroll', undefined, { Cookie: cookie, 'X-CSRF-Token': b1.csrf_token });
    const { secret, otpauth_url } = await en.json();
    expect(otpauth_url).toContain('otpauth://totp/');
    const cf = await post('/auth/totp/confirm', { code: authenticator.generate(secret) }, { Cookie: cookie, 'X-CSRF-Token': b1.csrf_token });
    expect(cf.status).toBe(200);
    const newCookie = cookieOf(cf);
    expect(newCookie).not.toBe(cookie);
    expect((await get('/optouts', { Cookie: newCookie })).status).toBe(200);
    expect((await get('/me', { Cookie: cookie })).status).toBe(401); // old token dead (and reuse revokes the family)
  });
});

describe('sessions', () => {
  it('refresh rotates the token; old token stops working; reuse of old token revokes the family', async () => {
    const u = await makeUser();
    const { cookie, csrf } = await fullLogin(u);
    const r = await post('/auth/refresh', undefined, { Cookie: cookie, 'X-CSRF-Token': csrf });
    expect(r.status).toBe(200);
    const c2 = cookieOf(r);
    expect(c2).not.toBe(cookie);
    expect((await get('/me', { Cookie: cookie })).status).toBe(401); // old token reused -> theft detection
    expect((await get('/me', { Cookie: c2 })).status).toBe(401);     // whole family revoked
  });

  it('expires after idle timeout', async () => {
    const u = await makeUser();
    const { cookie } = await fullLogin(u);
    expect((await get('/me', { Cookie: cookie })).status).toBe(200);
    await env.DB.prepare('UPDATE sessions SET last_seen_at = last_seen_at - 43201').run();
    expect((await get('/me', { Cookie: cookie })).status).toBe(401);
  });

  it('expires at the absolute cap even if active, and refresh does not extend it', async () => {
    const u = await makeUser();
    const { cookie, csrf } = await fullLogin(u);
    const before = await env.DB.prepare("SELECT expires_at FROM sessions WHERE stage='session' AND revoked=0").first();
    const r = await post('/auth/refresh', undefined, { Cookie: cookie, 'X-CSRF-Token': csrf });
    const after = await env.DB.prepare("SELECT expires_at FROM sessions WHERE stage='session' AND revoked=0").first();
    expect(after.expires_at).toBe(before.expires_at);
    await env.DB.prepare('UPDATE sessions SET expires_at = 1').run();
    expect((await get('/me', { Cookie: cookieOf(r) })).status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const u = await makeUser();
    const { cookie, csrf } = await fullLogin(u);
    const r = await post('/auth/logout', undefined, { Cookie: cookie, 'X-CSRF-Token': csrf });
    expect(r.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect((await get('/me', { Cookie: cookie })).status).toBe(401);
  });
});

describe('CSRF / Origin', () => {
  it('rejects state-changing requests without or with a wrong CSRF token', async () => {
    const u = await makeUser();
    const { cookie, csrf } = await fullLogin(u);
    expect((await post('/optouts', { broker_id: 'x' }, { Cookie: cookie })).status).toBe(403);
    expect((await post('/optouts', { broker_id: 'x' }, { Cookie: cookie, 'X-CSRF-Token': 'nope' })).status).toBe(403);
    expect((await post('/optouts', { broker_id: 'x' }, { Cookie: cookie, 'X-CSRF-Token': csrf })).status).toBe(201);
    expect((await post('/optouts', { broker_id: 'nope' }, { Cookie: cookie, 'X-CSRF-Token': csrf })).status).toBe(400);
  });

  it('rejects state-changing requests with a missing or foreign Origin', async () => {
    const u = await makeUser();
    const { cookie, csrf } = await fullLogin(u);
    const noOrigin = await SELF.fetch(BASE + '/optouts', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: '{}' });
    expect(noOrigin.status).toBe(403);
    expect((await post('/optouts', {}, { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: 'https://evil.example' })).status).toBe(403);
  });
});

describe('rate limiting', () => {
  it('locks login after 5 failures per IP+account, even with the right password', async () => {
    const u = await makeUser();
    for (let i = 0; i < 5; i++) expect((await post('/auth/login', { email: u.email, password: 'bad' })).status).toBe(401);
    expect((await post('/auth/login', { email: u.email, password: u.password })).status).toBe(429);
    IP = '10.9.9.9'; // different IP is a different bucket
    expect((await post('/auth/login', { email: u.email, password: u.password })).status).toBe(200);
  });

  it('limits opt-out writes to 30/hour per user', async () => {
    const u = await makeUser();
    const { cookie, csrf } = await fullLogin(u);
    const h = { Cookie: cookie, 'X-CSRF-Token': csrf };
    for (let i = 0; i < 30; i++) expect((await post('/optouts', { broker_id: 'b' }, h)).status).toBe(201);
    expect((await post('/optouts', { broker_id: 'b' }, h)).status).toBe(429);
  });
});

describe('opt-outs, purge, legacy', () => {
  it('logs confirmation numbers and purge removes PII past retention', async () => {
    const u = await makeUser();
    const { cookie, csrf } = await fullLogin(u);
    const { id } = await (await post('/optouts', { broker_id: 'spokeo' }, { Cookie: cookie, 'X-CSRF-Token': csrf })).json();
    expect((await post(`/optouts/${id}/confirmations`, { confirmation_no: 'ABC-123' }, { Cookie: cookie, 'X-CSRF-Token': csrf })).status).toBe(201);
    await env.DB.prepare('INSERT INTO pii_payloads (request_id, payload_enc, purge_after) VALUES (?1, ?2, ?3)').bind(id, 'x.y', 9999999999).run();
    await env.DB.prepare('UPDATE optout_requests SET confirmed_at = 1 WHERE id = ?1').bind(id).run();
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController(), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await env.DB.prepare('SELECT 1 FROM pii_payloads').first()).toBeNull();
    expect((await env.DB.prepare('SELECT confirmation_no FROM confirmations').first()).confirmation_no).toBe('ABC-123');
  });

  it('legacy KV routes still work with the shared key', async () => {
    expect((await SELF.fetch(BASE + '/records')).status).toBe(401);
    const r = await SELF.fetch(BASE + '/records', { headers: { Authorization: 'Bearer test-legacy-token' } });
    expect(r.status).toBe(200);
  });
});

describe('credentialed CORS', () => {
  it('echoes the exact allowlisted origin with credentials and Vary: Origin', async () => {
    const u = await makeUser();
    const r = await post('/auth/login', { email: u.email, password: u.password });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(r.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(r.headers.get('Vary')).toContain('Origin');
    const other = await post('/auth/login', { email: u.email, password: u.password }, { Origin: 'https://privacy-dashboard-bt.pages.dev' });
    expect(other.headers.get('Access-Control-Allow-Origin')).toBe('https://privacy-dashboard-bt.pages.dev');
  });

  it('preflight allows X-CSRF-Token for allowlisted origins and is refused otherwise', async () => {
    const pre = (origin) => SELF.fetch(BASE + '/optouts', { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-csrf-token' } });
    const ok = await pre(ORIGIN);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(ok.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(ok.headers.get('Access-Control-Allow-Headers')).toMatch(/X-CSRF-Token/i);
    const bad = await pre('https://evil.example');
    expect(bad.status).toBe(403);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('never returns a wildcard origin', async () => {
    const r = await get('/me', { Origin: undefined });
    expect(r.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
  });

  it('rejects a non-allowlisted origin even with a valid cookie and CSRF token (GET and POST)', async () => {
    const u = await makeUser();
    const { cookie, csrf } = await fullLogin(u);
    const evil = { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: 'https://evil.example' };
    const g = await get('/optouts', evil);
    expect(g.status).toBe(403);
    expect(g.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await post('/optouts', { broker_id: 'x' }, evil)).status).toBe(403);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM optout_requests').first()).n).toBe(0);
  });

  it('GET routes do not change application state', async () => {
    const u = await makeUser();
    const { cookie } = await fullLogin(u);
    const count = async () => (await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM optout_requests) + (SELECT COUNT(*) FROM confirmations) + (SELECT COUNT(*) FROM users WHERE totp_pending_enc IS NOT NULL) AS n").first()).n;
    const before = await count();
    for (const p of ['/me', '/optouts', '/auth/logout', '/auth/refresh', '/auth/totp/enroll', '/optouts/00000000-0000-0000-0000-000000000000/confirmations']) await get(p, { Cookie: cookie });
    expect(await count()).toBe(before);
    expect((await get('/me', { Cookie: cookie })).status).toBe(200); // GET /auth/logout did not log out
  });
});
