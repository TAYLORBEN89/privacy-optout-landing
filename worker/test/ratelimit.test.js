import { env, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import { hashPassword, encryptStr } from '../src/crypto.js';
import { isLimited, hit, LIMITS } from '../src/ratelimit.js';
import { purge } from '../src/app.js';

const ORIGIN = 'http://localhost:5173';
const BASE = 'https://api.test';
let n = 0;
const ip = () => `10.88.${Math.floor(++n / 250)}.${n % 250}`;

async function makeUser(password = 'correct horse battery') {
  const email = `rl-${crypto.randomUUID()}@example.test`;
  const secret = authenticator.generateSecret(20);
  await env.DB.prepare('INSERT INTO users (id, email, pw_hash, totp_secret_enc, totp_enabled, created_at) VALUES (?1, ?2, ?3, ?4, 1, 1)')
    .bind(crypto.randomUUID(), email, await hashPassword(password), await encryptStr(env, secret)).run();
  return { email, password, secret };
}
const post = (path, body, IP) => SELF.fetch(BASE + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': IP }, body: JSON.stringify(body),
});
const login = (u, IP, password = 'wrong password') => post('/auth/login', { email: u.email, password }, IP);

describe('D1-backed rate limiting (pen test 2026-11-01 #1)', () => {
  it('returns 429 with Retry-After from the 6th failed login, including the 11th; bodies stay uniform', async () => {
    const u = await makeUser(); const IP = ip();
    const statuses = [];
    let last;
    for (let i = 0; i < 11; i++) { last = await login(u, IP); statuses.push(last.status); }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429, 429, 429, 429, 429]);
    expect(await last.json()).toEqual({ error: 'too many attempts' });
    const ra = Number(last.headers.get('Retry-After'));
    expect(ra).toBeGreaterThan(0);
    expect(ra).toBeLessThanOrEqual(LIMITS.login.windowSec);
    // Even the right password is refused while limited.
    expect((await login(u, IP, u.password)).status).toBe(429);
    // Nothing was written to KV, and no raw identifier is stored in D1.
    expect((await env.RECORDS.list({ prefix: 'rl:' })).keys.length).toBe(0);
    const rows = (await env.DB.prepare('SELECT key FROM rate_limits').all()).results;
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.key))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(u.email);
  });

  it('limits TOTP verification the same way', async () => {
    const u = await makeUser(); const IP = ip();
    const r1 = await login(u, IP, u.password);
    expect(r1.status).toBe(200);
    const { preauth_token } = await r1.json();
    const statuses = [];
    let last;
    for (let i = 0; i < 6; i++) { last = await post('/auth/totp/verify', { preauth_token, code: '000000' }, IP); statuses.push(last.status); }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(Number(last.headers.get('Retry-After'))).toBeGreaterThan(0);
    // A correct code is refused while limited.
    expect((await post('/auth/totp/verify', { preauth_token, code: authenticator.generate(u.secret) }, IP)).status).toBe(429);
  });

  it('different accounts and different IPs do not share a counter', async () => {
    const a = await makeUser(); const b = await makeUser(); const IP1 = ip(); const IP2 = ip();
    for (let i = 0; i < 5; i++) await login(a, IP1);
    expect((await login(a, IP1)).status).toBe(429);
    expect((await login(b, IP1)).status).toBe(401); // other account, same IP
    expect((await login(a, IP2)).status).toBe(401); // same account, other IP
    expect((await login(a, IP2, a.password)).status).toBe(200);
  });

  it('windows reset, and the cron purges ended windows', async () => {
    const id = `203.0.113.9|${crypto.randomUUID()}`;
    const w = LIMITS.login.windowSec;
    const t0 = Math.floor(1_900_000_000 / w) * w; // start of a window
    for (let i = 1; i <= 5; i++) expect(await hit(env, 'login', id, t0 + i)).toBe(i);
    expect(await isLimited(env, 'login', id, t0 + 10)).toBe(w - 10);
    expect(await isLimited(env, 'login', id, t0 + w)).toBe(0); // next window
    expect(await hit(env, 'login', id, t0 + w)).toBe(1);
    await purge(env, t0 + w + 1);
    const left = (await env.DB.prepare('SELECT window_start FROM rate_limits WHERE window_start IN (?1, ?2)').bind(t0, t0 + w).all()).results;
    expect(left.map((r) => r.window_start)).toEqual([t0 + w]);
  });

  it('concurrent failures are all counted (atomic UPSERT)', async () => {
    const id = `198.51.100.7|${crypto.randomUUID()}`;
    const counts = await Promise.all(Array.from({ length: 8 }, () => hit(env, 'login', id)));
    expect(counts.sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
