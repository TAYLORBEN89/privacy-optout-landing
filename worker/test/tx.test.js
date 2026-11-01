import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { authenticator } from 'otplib';
import { hashPassword, encryptStr } from '../src/crypto.js';
import { TX_TO_DB } from '../src/txmap.js';
import { TX_STATUS } from '../scripts/kv-mapping.mjs';

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

beforeEach(async () => {
  IP = `10.9.0.${++n}`;
  await env.DB.batch(['confirmations', 'pii_payloads', 'optout_requests', 'sessions', 'users'].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});

describe('Texas requests as per-user D1 rows', () => {
  it('upserts kind=tx rows owned by the session user and maps statuses', async () => {
    const a = await makeUser('a@example.test'); const ha = await login(a);
    let r = await req('PUT', '/tx-requests/tx-acme-data', { status: 'sent', sentDate: '2026-10-01', deadline: '2026-11-15', notes: 'n' }, ha);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id: 'tx-acme-data', status: 'sent', sentDate: '2026-10-01', deadline: '2026-11-15' });
    r = await req('PUT', '/tx-requests/tx-acme-data', { status: 'no_data', sentDate: '2026-10-01' }, ha);
    expect((await r.json()).status).toBe('no_data');
    const rows = (await env.DB.prepare("SELECT * FROM optout_requests WHERE kind = 'tx'").all()).results;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: a.id, service_id: 'tx-acme-data', status: 'confirmed', sub_status: 'no_record' });
    expect(rows[0].finished_at).not.toBeNull();
    for (const [s, db] of [['appealed', 'pending'], ['ag_complaint', 'denied'], ['sent', 'submitted']]) {
      expect((await (await req('PUT', '/tx-requests/tx-acme-data', { status: s }, ha)).json()).status).toBe(s);
      const row = await env.DB.prepare("SELECT status, finished_at FROM optout_requests WHERE kind = 'tx'").first();
      expect(row.status).toBe(db);
      expect(row.finished_at === null).toBe(db !== 'denied');
    }
  });

  it('scopes every route to the session user', async () => {
    const a = await makeUser('a@example.test'); const b = await makeUser('b@example.test');
    const ha = await login(a); const hb = await login(b);
    await req('PUT', '/tx-requests/tx-acme-data', { status: 'sent' }, ha);
    expect((await req('GET', '/tx-requests/tx-acme-data', undefined, hb)).status).toBe(404);
    expect(await (await req('GET', '/tx-requests', undefined, hb)).json()).toEqual([]);
    await req('PUT', '/tx-requests/tx-acme-data', { status: 'denied' }, hb); // B's own row, A's untouched
    expect((await (await req('GET', '/tx-requests/tx-acme-data', undefined, ha)).json()).status).toBe('sent');
    expect((await (await req('GET', '/tx-requests', undefined, ha)).json())).toHaveLength(1);
    await env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(a.id).run(); // FK cascade
    expect((await env.DB.prepare('SELECT COUNT(*) c FROM optout_requests WHERE user_id = ?1').bind(a.id).first()).c).toBe(0);
  });

  it('requires an MFA session, CSRF, valid ids and statuses', async () => {
    const a = await makeUser('a@example.test'); const ha = await login(a);
    expect((await req('GET', '/tx-requests')).status).toBe(401);
    expect((await req('PUT', '/tx-requests/tx-x', { status: 'sent' }, { Cookie: ha.Cookie })).status).toBe(403);
    expect((await req('PUT', '/tx-requests/not-a-tx-id', { status: 'sent' }, ha)).status).toBe(400);
    expect((await req('PUT', '/tx-requests/tx-x', { status: 'bogus' }, ha)).status).toBe(400);
  });

  it('uses the same status mapping as the KV migration', () => { expect(TX_TO_DB).toEqual(TX_STATUS); });

  it('audit target is the stored row id; writes share the opt-out limiter (30/h, rejects count) with Retry-After', async () => {
    const a = await makeUser('rl@example.test'); const ha = await login(a);
    await req('PUT', '/tx-requests/tx-acme-data', { status: 'sent' }, ha);
    const row = await env.DB.prepare("SELECT id FROM optout_requests WHERE kind = 'tx' AND user_id = ?1").bind(a.id).first();
    const aud = await env.DB.prepare("SELECT target FROM audit_log WHERE user_id = ?1 AND action LIKE 'tx.%' ORDER BY id DESC LIMIT 1").bind(a.id).first();
    expect(aud.target).toBe(row.id);
    for (let i = 0; i < 29; i++) await req('PUT', '/tx-requests/tx-acme-data', { status: 'bogus' }, ha); // 400s still count
    const r = await req('PUT', '/tx-requests/tx-acme-data', { status: 'sent' }, ha);
    expect(r.status).toBe(429);
    expect(Number(r.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('signup rows (kind=tx, service_id=signup) stay repeatable and never show up as Texas requests', async () => {
    const a = await makeUser('su@example.test'); const ha = await login(a);
    const ins = "INSERT INTO optout_requests (id, user_id, status, created_at, updated_at, kind, service_id) VALUES (?1, ?2, 'queued', 1, 1, 'tx', 'signup')";
    await env.DB.prepare(ins).bind(crypto.randomUUID(), a.id).run();
    await env.DB.prepare(ins).bind(crypto.randomUUID(), a.id).run(); // second signup: no unique violation
    await req('PUT', '/tx-requests/tx-acme-data', { status: 'sent' }, ha);
    const list = await (await req('GET', '/tx-requests', undefined, ha)).json();
    expect(list.map((x) => x.id)).toEqual(['tx-acme-data']);
  });
});

