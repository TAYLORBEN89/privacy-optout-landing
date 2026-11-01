import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { authenticator } from 'otplib';
import worker from '../src/index.js';
import { hashPassword, encryptStr, encryptPii, decryptPii } from '../src/crypto.js';
import { purge, inactiveAccounts } from '../src/app.js';

const ORIGIN = 'http://localhost:5173';
const BASE = 'https://api.test';
const DAY = 86400;
let IP; let n = 0;

async function makeUser({ email = 'owner@example.test', password = 'correct horse battery', totp = true } = {}) {
  const id = crypto.randomUUID();
  const secret = authenticator.generateSecret(20);
  await env.DB.prepare('INSERT INTO users (id, email, pw_hash, totp_secret_enc, totp_enabled, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(id, email, await hashPassword(password), totp ? await encryptStr(env, secret) : null, totp ? 1 : 0, 1).run();
  return { id, email, password, secret };
}
const req = (method, path, body, headers = {}) => SELF.fetch(BASE + path, {
  method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': IP, ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const cookieOf = (r) => (r.headers.get('Set-Cookie') || '').split(';')[0];
async function preauth(u) { return (await (await req('POST', '/auth/login', { email: u.email, password: u.password })).json()).preauth_token; }
async function fullLogin(u) {
  const r = await req('POST', '/auth/totp/verify', { preauth_token: await preauth(u), code: authenticator.generate(u.secret) });
  expect(r.status).toBe(200);
  const b = await r.json();
  return { Cookie: cookieOf(r), 'X-CSRF-Token': b.csrf_token };
}
async function newOptout(h, body = {}) {
  const r = await req('POST', '/optouts', { broker_id: 'spokeo', ...body }, h);
  expect(r.status).toBe(201);
  return (await r.json()).id;
}

beforeEach(async () => {
  IP = `10.1.0.${++n}`;
  await env.DB.batch(['confirmations', 'pii_payloads', 'optout_requests', 'sessions', 'users']
    .map((t) => env.DB.prepare(`DELETE FROM ${t}`))); // test-only fixed table names
  await env.DB.prepare("INSERT OR IGNORE INTO brokers (id, name, url, category) VALUES ('spokeo', 'Spokeo', 'https://spokeo.com', 'people'), ('acxiom', 'Acxiom', NULL, 'brokers')").run();
});

describe('backup codes', () => {
  async function enrolled() {
    const u = await makeUser({ totp: false });
    const r1 = await req('POST', '/auth/login', { email: u.email, password: u.password });
    const b1 = await r1.json();
    const h = { Cookie: cookieOf(r1), 'X-CSRF-Token': b1.csrf_token };
    const { secret } = await (await req('POST', '/auth/totp/enroll', undefined, h)).json();
    const cf = await req('POST', '/auth/totp/confirm', { code: authenticator.generate(secret) }, h);
    const body = await cf.json();
    return { u: { ...u, secret }, codes: body.backup_codes, h: { Cookie: cookieOf(cf), 'X-CSRF-Token': body.csrf_token } };
  }

  it('issues 10 unique high-entropy codes at TOTP confirm, stored only as hashes', async () => {
    const { u, codes } = await enrolled();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
    const rows = (await env.DB.prepare('SELECT code_hash FROM backup_codes WHERE user_id = ?1').bind(u.id).all()).results;
    expect(rows).toHaveLength(10);
    for (const r of rows) { expect(r.code_hash).toMatch(/^[0-9a-f]{64}$/); expect(codes.map((c) => c.replace(/-/g, ''))).not.toContain(r.code_hash); }
  });

  it('a backup code works in place of TOTP exactly once (case/dash-insensitive)', async () => {
    const { u, codes } = await enrolled();
    const ok = await req('POST', '/auth/totp/verify', { preauth_token: await preauth(u), code: codes[0].toUpperCase().replace(/-/g, ' ') });
    expect(ok.status).toBe(200);
    const again = await req('POST', '/auth/totp/verify', { preauth_token: await preauth(u), code: codes[0] });
    expect(again.status).toBe(401);
    expect(await again.text()).toBe('{"error":"invalid credentials"}');
    const wrong = await req('POST', '/auth/totp/verify', { preauth_token: await preauth(u), code: 'aaaa-bbbb-cccc-dddd' });
    expect(wrong.status).toBe(401);
  });

  it('backup code failures count toward the login rate limit', async () => {
    const { u } = await enrolled();
    for (let i = 0; i < 4; i++) expect((await req('POST', '/auth/totp/verify', { preauth_token: await preauth(u), code: 'aaaa-bbbb-cccc-dddd' })).status).toBe(401);
    // 4 fails so far; the 5th fail trips the limit for the next attempt
    expect((await req('POST', '/auth/totp/verify', { preauth_token: await preauth(u), code: 'aaaa-bbbb-cccc-dddd' })).status).toBe(401);
    expect((await req('POST', '/auth/login', { email: u.email, password: u.password })).status).toBe(429);
  });

  it('regenerate requires CSRF + MFA session, replaces all old codes', async () => {
    const { u, codes, h } = await enrolled();
    expect((await req('POST', '/auth/backup-codes/regenerate', undefined, { Cookie: h.Cookie })).status).toBe(403);
    const r = await req('POST', '/auth/backup-codes/regenerate', undefined, h);
    expect(r.status).toBe(200);
    const fresh = (await r.json()).backup_codes;
    expect(fresh).toHaveLength(10);
    expect((await req('POST', '/auth/totp/verify', { preauth_token: await preauth(u), code: codes[1] })).status).toBe(401);
    expect((await req('POST', '/auth/totp/verify', { preauth_token: await preauth(u), code: fresh[0] })).status).toBe(200);
    // password-only session cannot regenerate
    const u2 = await makeUser({ email: 'p@example.test', totp: false });
    const r2 = await req('POST', '/auth/login', { email: u2.email, password: u2.password });
    const b2 = await r2.json();
    expect((await req('POST', '/auth/backup-codes/regenerate', undefined, { Cookie: cookieOf(r2), 'X-CSRF-Token': b2.csrf_token })).status).toBe(403);
  });
});

describe('PATCH /optouts/:id', () => {
  it('validates status transitions, sets timestamps, writes audit rows', async () => {
    const u = await makeUser(); const h = await fullLogin(u);
    const id = await newOptout(h);
    const bad = await req('PATCH', `/optouts/${id}`, { status: 'confirmed' }, h);
    expect(bad.status).toBe(409);
    expect((await bad.json()).allowed).toEqual(['submitted', 'in_progress']);
    const s1 = await req('PATCH', `/optouts/${id}`, { status: 'submitted', notes: 'sent form' }, h);
    expect(s1.status).toBe(200);
    const r1 = await s1.json();
    expect(r1.submitted_at).toBeGreaterThan(0);
    expect(r1.notes).toBe('sent form');
    const r2 = await (await req('PATCH', `/optouts/${id}`, { status: 'confirmed' }, h)).json();
    expect(r2.confirmed_at).toBeGreaterThan(0);
    expect(r2.finished_at).toBeGreaterThan(0);
    expect(r2.updated_at).toBeGreaterThanOrEqual(r1.updated_at);
    const r3 = await (await req('PATCH', `/optouts/${id}`, { status: 'reverify' }, h)).json();
    expect(r3.finished_at).toBeNull();
    const audits = (await env.DB.prepare("SELECT action FROM audit_log WHERE target = ?1 AND action LIKE 'optout.status:%' ORDER BY id").bind(id).all()).results.map((a) => a.action);
    expect(audits).toEqual(['optout.status:queued->submitted', 'optout.status:submitted->confirmed', 'optout.status:confirmed->reverify']);
    expect((await req('PATCH', `/optouts/${id}`, { status: 'bogus' }, h)).status).toBe(409);
    expect((await req('PATCH', `/optouts/${id}`, { next_reverify: 'soon' }, h)).status).toBe(400);
  });

  it("cannot touch another user's record; requires CSRF; rejects bad ids", async () => {
    const a = await makeUser(); const ha = await fullLogin(a);
    const id = await newOptout(ha);
    const b = await makeUser({ email: 'other@example.test' }); const hb = await fullLogin(b);
    expect((await req('PATCH', `/optouts/${id}`, { status: 'submitted' }, hb)).status).toBe(404);
    expect((await req('PATCH', `/optouts/${id}`, { status: 'submitted' }, { Cookie: ha.Cookie })).status).toBe(403);
    expect((await req('PATCH', '/optouts/not-a-uuid', { status: 'submitted' }, ha)).status).toBe(404);
  });
});

describe('encrypted PII + profile', () => {
  it('stores PII encrypted (random IV, key version, AAD-bound) and returns it decrypted', async () => {
    const u = await makeUser(); const h = await fullLogin(u);
    const id = await newOptout(h);
    const pii = { full_name: 'Test Person', address: '1 Test St' };
    expect((await req('PATCH', `/optouts/${id}`, { pii }, h)).status).toBe(200);
    const row1 = await env.DB.prepare('SELECT * FROM pii_payloads WHERE request_id = ?1').bind(id).first();
    expect(row1.payload_enc).not.toContain('Test Person');
    expect(row1.key_version).toBe(1);
    expect(row1.purge_after - row1.created_at).toBe(90 * DAY);
    await req('PATCH', `/optouts/${id}`, { pii }, h);
    const row2 = await env.DB.prepare('SELECT * FROM pii_payloads WHERE request_id = ?1').bind(id).first();
    expect(row2.payload_enc.split('.')[0]).not.toBe(row1.payload_enc.split('.')[0]); // fresh IV
    expect(row2.purge_after).toBe(row1.purge_after); // update doesn't extend hard max
    expect((await (await req('GET', `/optouts/${id}/pii`, undefined, h)).json()).pii).toEqual(pii);
    expect((await req('PATCH', `/optouts/${id}`, { pii: null }, h)).status).toBe(200);
    expect((await req('GET', `/optouts/${id}/pii`, undefined, h)).status).toBe(404);
  });

  it('PII key is separate from the TOTP key; AAD prevents moving ciphertext between rows', async () => {
    const { blob, version } = await encryptPii(env, 'secret', 'pii:a');
    expect(await decryptPii(env, blob, version, 'pii:a')).toBe('secret');
    await expect(decryptPii(env, blob, version, 'pii:b')).rejects.toThrow();
    await expect(decryptPii({ ...env, PII_ENC_KEY: env.TOTP_ENC_KEY }, blob, version, 'pii:a')).rejects.toThrow();
    // rotation: old key still readable via PII_ENC_KEY_PREV
    const rotated = { ...env, PII_ENC_KEY: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=', PII_KEY_VERSION: '2', PII_ENC_KEY_PREV: env.PII_ENC_KEY, PII_PREV_KEY_VERSION: '1' };
    expect(await decryptPii(rotated, blob, 1, 'pii:a')).toBe('secret');
    expect((await encryptPii(rotated, 'x', 'y')).version).toBe(2);
  });

  it('GET/PUT /profile round-trips encrypted', async () => {
    const u = await makeUser(); const h = await fullLogin(u);
    expect(await (await req('GET', '/profile', undefined, h)).json()).toEqual({});
    const p = { name: 'Test Person', email: 'tp@example.test' };
    expect((await req('PUT', '/profile', p, h)).status).toBe(200);
    expect((await req('PUT', '/profile', p, { Cookie: h.Cookie })).status).toBe(403);
    const row = await env.DB.prepare('SELECT payload_enc FROM profiles WHERE user_id = ?1').bind(u.id).first();
    expect(row.payload_enc).not.toContain('Test Person');
    expect(await (await req('GET', '/profile', undefined, h)).json()).toEqual(p);
  });

  it('legacy GET/PUT /profile and GET /optouts/:id/pii require step-up (M1)', async () => {
    const u = await makeUser(); const h = await fullLogin(u);
    const id = await newOptout(h);
    await req('PATCH', `/optouts/${id}`, { pii: { full_name: 'X' } }, h);
    await env.DB.prepare('UPDATE sessions SET stepped_up_at = ?1 WHERE user_id = ?2').bind(Math.floor(Date.now() / 1000) - 601, u.id).run();
    for (const [m, path, body] of [['GET', '/profile'], ['PUT', '/profile', { name: 'n' }], ['GET', `/optouts/${id}/pii`]]) {
      const r = await req(m, path, body, h);
      expect(r.status).toBe(403);
      expect((await r.json()).error).toBe('step_up_required');
    }
  });

  it('GET /brokers lists brokers for MFA sessions only', async () => {
    const u = await makeUser(); const h = await fullLogin(u);
    const list = await (await req('GET', '/brokers', undefined, h)).json();
    expect(list.map((b) => b.id)).toEqual(['acxiom', 'spokeo']);
    expect((await req('GET', '/brokers')).status).toBe(401);
  });
});

describe('retention purge', () => {
  it('applies PII 30d/90d, sessions 7d, finished records 24 months, Texas 3 years; leaves audit_log alone', async () => {
    const u = await makeUser();
    const t = Math.floor(Date.now() / 1000);
    const ins = (id, kind, status, finished, confirmed = null) => env.DB.prepare(
      'INSERT INTO optout_requests (id, user_id, status, kind, finished_at, confirmed_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 1)',
    ).bind(id, u.id, status, kind, finished, confirmed).run();
    const pii = (id, purgeAfter) => env.DB.prepare('INSERT INTO pii_payloads (request_id, payload_enc, purge_after, created_at) VALUES (?1, ?2, ?3, 1)').bind(id, 'x.y', purgeAfter).run();
    await ins('opt-old', 'optout', 'confirmed', t - 731 * DAY, t - 731 * DAY);
    await ins('opt-keep', 'optout', 'confirmed', t - 729 * DAY, t - 729 * DAY);
    await ins('opt-open', 'optout', 'submitted', null);
    await ins('tx-old', 'tx', 'denied', t - 1096 * DAY);
    await ins('tx-keep', 'tx', 'confirmed', t - 1000 * DAY, t - 1000 * DAY); // > 24 months but < 3 years
    await ins('pii-confirmed-31', 'optout', 'confirmed', t - 31 * DAY, t - 31 * DAY);
    await ins('pii-confirmed-29', 'optout', 'confirmed', t - 29 * DAY, t - 29 * DAY);
    await ins('pii-hardmax', 'optout', 'submitted', null);
    await pii('pii-confirmed-31', t + 10 * DAY);
    await pii('pii-confirmed-29', t + 10 * DAY);
    await pii('pii-hardmax', t - 1);
    await env.DB.prepare('INSERT INTO confirmations (request_id, confirmation_no, received_at) VALUES (?1, ?2, 1)').bind('opt-old', 'OLD-1').run();
    const sess = (id, exp, revoked, seen) => env.DB.prepare(
      "INSERT INTO sessions (id_hash, user_id, stage, created_at, last_seen_at, expires_at, revoked) VALUES (?1, ?2, 'session', 1, ?3, ?4, ?5)",
    ).bind(id, u.id, seen, exp, revoked).run();
    await sess('s-expired-8d', t - 8 * DAY, 0, t - 8 * DAY);
    await sess('s-expired-6d', t - 6 * DAY, 0, t - 6 * DAY);
    await sess('s-revoked-8d', t + DAY, 1, t - 8 * DAY);
    await sess('s-live', t + DAY, 0, t);
    await env.DB.prepare('INSERT INTO audit_log (user_id, action, at) VALUES (?1, ?2, 1)').bind(u.id, 'ancient').run();

    await purge(env, t);

    const ids = (await env.DB.prepare('SELECT id FROM optout_requests ORDER BY id').all()).results.map((r) => r.id);
    expect(ids).toEqual(['opt-keep', 'opt-open', 'pii-confirmed-29', 'pii-confirmed-31', 'pii-hardmax', 'tx-keep']);
    const piiLeft = (await env.DB.prepare('SELECT request_id FROM pii_payloads').all()).results.map((r) => r.request_id);
    expect(piiLeft).toEqual(['pii-confirmed-29']);
    expect(await env.DB.prepare("SELECT 1 FROM confirmations WHERE request_id = 'opt-old'").first()).toBeNull();
    const sl = (await env.DB.prepare('SELECT id_hash FROM sessions ORDER BY id_hash').all()).results.map((r) => r.id_hash);
    expect(sl).toEqual(['s-expired-6d', 's-live']);
    expect(await env.DB.prepare("SELECT 1 FROM audit_log WHERE action = 'ancient'").first()).not.toBeNull();
  });

  it('retention windows are configurable via env vars', async () => {
    const u = await makeUser();
    const t = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO optout_requests (id, user_id, status, kind, finished_at, created_at, updated_at) VALUES ('tx-10d', ?1, 'denied', 'tx', ?2, 1, 1)")
      .bind(u.id, t - 10 * DAY).run();
    await purge({ ...env, TX_RECORD_RETENTION_DAYS: '9' }, t);
    expect(await env.DB.prepare("SELECT 1 FROM optout_requests WHERE id = 'tx-10d'").first()).toBeNull();
  });
});

describe('first-user bootstrap', () => {
  const boot = (body, token = env.ADMIN_BOOTSTRAP_TOKEN) => req('POST', '/admin/bootstrap', body, { Authorization: `Bearer ${token}` });

  it('creates the first user once, then self-disables', async () => {
    expect((await boot({ email: 'owner@example.test', password: 'short' })).status).toBe(400);
    const r = await boot({ email: 'Owner@Example.test', password: 'a-long-enough-password' });
    expect(r.status).toBe(201);
    expect((await boot({ email: 'x@example.test', password: 'a-long-enough-password' })).status).toBe(404);
    const login = await req('POST', '/auth/login', { email: 'owner@example.test', password: 'a-long-enough-password' });
    expect((await login.json()).totp_enrollment_required).toBe(true);
  });

  it('rejects wrong/missing token, missing Origin, and is disabled when no token is configured', async () => {
    expect((await boot({ email: 'a@example.test', password: 'a-long-enough-password' }, 'wrong')).status).toBe(404);
    const noOrigin = await SELF.fetch(BASE + '/admin/bootstrap', { method: 'POST', headers: { Authorization: `Bearer ${env.ADMIN_BOOTSTRAP_TOKEN}` }, body: '{}' });
    expect(noOrigin.status).toBe(403);
    const r = await worker.fetch(new Request(BASE + '/admin/bootstrap', { method: 'POST', headers: { Origin: ORIGIN, Authorization: 'Bearer ' }, body: JSON.stringify({ email: 'a@example.test', password: 'a-long-enough-password' }) }), { ...env, ADMIN_BOOTSTRAP_TOKEN: '' });
    expect(r.status).toBe(404);
    expect(await env.DB.prepare('SELECT 1 FROM users').first()).toBeNull();
  });
});

describe('cookie SameSite mode', () => {
  it('SESSION_COOKIE_SAMESITE=None adds Partitioned for the cross-site setup', async () => {
    const u = await makeUser({ totp: false });
    const r = await worker.fetch(new Request(BASE + '/auth/login', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': IP }, body: JSON.stringify({ email: u.email, password: u.password }) }), { ...env, SESSION_COOKIE_SAMESITE: 'None' });
    const sc = r.headers.get('Set-Cookie');
    expect(sc).toContain('SameSite=None');
    expect(sc).toContain('Partitioned');
  });
});

describe('in_progress status + retention clock', () => {
  it('supports in_progress transitions and keeps it unfinished', async () => {
    const u = await makeUser(); const h = await fullLogin(u);
    const id = await newOptout(h, { kind: 'tx' });
    const r1 = await (await req('PATCH', `/optouts/${id}`, { status: 'in_progress' }, h)).json();
    expect(r1.status).toBe('in_progress');
    expect(r1.finished_at).toBeNull();
    const r2 = await (await req('PATCH', `/optouts/${id}`, { status: 'confirmed', sub_status: 'no_record' }, h)).json();
    expect(r2.finished_at).toBeGreaterThan(0);
    expect(r2.sub_status).toBe('no_record');
    expect((await req('PATCH', `/optouts/${id}`, { status: 'in_progress' }, h)).status).toBe(409); // confirmed -> reverify only
    const raw = await env.DB.prepare('SELECT status FROM optout_requests WHERE id = ?1').bind(id).first();
    expect(raw.status).toBe('confirmed');
  });

  it('retention counts from finished_at, not created_at; unfinished records are never purged', async () => {
    const u = await makeUser();
    const t = Math.floor(Date.now() / 1000);
    const ins = (id, kind, status, created, finished) => env.DB.prepare(
      'INSERT INTO optout_requests (id, user_id, status, kind, created_at, updated_at, finished_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)',
    ).bind(id, u.id, status, kind, created, finished).run();
    await ins('opt-created-old-finished-recent', 'optout', 'confirmed', t - 2000 * DAY, t - 10 * DAY);
    await ins('tx-created-old-finished-recent', 'tx', 'denied', t - 3000 * DAY, t - 10 * DAY);
    await ins('tx-ancient-in-progress', 'tx', 'in_progress', t - 4000 * DAY, null);
    await ins('opt-ancient-pending', 'optout', 'pending', t - 4000 * DAY, null);
    await purge(env, t);
    const ids = (await env.DB.prepare('SELECT id FROM optout_requests ORDER BY id').all()).results.map((r) => r.id);
    expect(ids).toEqual(['opt-ancient-pending', 'opt-created-old-finished-recent', 'tx-ancient-in-progress', 'tx-created-old-finished-recent']);
  });
});

describe('last_active_at', () => {
  it('is set on login and clears a pending inactivity warning', async () => {
    const u = await makeUser();
    await env.DB.prepare('UPDATE users SET last_active_at = 5, inactivity_warned_at = 6 WHERE id = ?1').bind(u.id).run();
    await fullLogin(u);
    const r = await env.DB.prepare('SELECT last_active_at, inactivity_warned_at FROM users WHERE id = ?1').bind(u.id).first();
    expect(r.last_active_at).toBeGreaterThan(1_700_000_000);
    expect(r.inactivity_warned_at).toBeNull();
  });
  it('a login during the warning window cancels deletion (login race)', async () => {
    const u = await makeUser({ email: 'race@example.test' });
    const t = Math.floor(Date.now() / 1000);
    await env.DB.prepare('UPDATE users SET created_at = 1, last_active_at = ?1, inactivity_warned_at = ?2 WHERE id = ?3')
      .bind(t - 800 * DAY, t - 20 * DAY, u.id).run();
    await fullLogin(u); // signs in after the warning, before the cron's DELETE
    const r = await inactiveAccounts({ ...env, MAILER: { send: async () => ({}) }, MAIL_FROM: 'a@example.test' }, t + 60);
    expect(r.deleted).toBe(0);
    expect(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?1').bind(u.id).first()).not.toBeNull();
  });
});
