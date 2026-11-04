// Anonymous writes: no cookie, garbage cookie, expired session and revoked session all get the uniform 401 on every
// write route, and nothing is written to D1 (row counts and the existing rows are unchanged).
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

const TABLES = ['optout_requests', 'pii_payloads', 'confirmations', 'profiles'];
async function snapshot() {
  const counts = {};
  for (const t of TABLES) counts[t] = (await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${t}`).first()).c;
  const rows = (await env.DB.prepare('SELECT * FROM optout_requests ORDER BY id').all()).results;
  return { counts, rows };
}

beforeEach(async () => {
  IP = `10.77.0.${++n}`;
  await env.DB.batch(['confirmations', 'pii_payloads', 'optout_requests', 'profiles', 'sessions', 'users'].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  await env.DB.prepare("INSERT OR IGNORE INTO brokers (id, name, url, category) VALUES ('spokeo', 'Spokeo', 'https://spokeo.com', 'people')").run();
});

describe('anonymous write routes get the uniform 401 and write nothing', () => {
  it('no cookie, garbage cookie, expired session, revoked session', async () => {
    const u = await makeUser('owner@example.test');
    const h = await login(u);
    // seed one opt-out and one Texas row with a valid session, so PATCH/PUT have real targets
    const created = await req('POST', '/optouts', { broker_id: 'spokeo' }, h);
    expect(created.status).toBe(201);
    const optId = (await created.json()).id;
    expect((await req('PUT', '/tx-requests/tx-acme-data', { status: 'sent', sentDate: '2026-10-01' }, h)).status).toBe(200);
    const cookieName = h.Cookie.split('=')[0];

    const writes = [
      ['PUT', '/tx-requests/tx-acme-data', { status: 'denied', notes: 'x' }],
      ['PUT', '/api/tx-requests/tx-acme-data', { status: 'denied', notes: 'x' }],
      ['PUT', '/tx-requests/tx-new-broker', { status: 'sent' }],
      ['PATCH', `/optouts/${optId}`, { status: 'submitted', notes: 'x' }],
      ['POST', '/optouts', { broker_id: 'spokeo' }],
    ];
    const check = async (label, headers) => {
      const before = await snapshot();
      for (const [m, path, body] of writes) {
        const r = await req(m, path, body, headers);
        expect(r.status, `${label}: ${m} ${path}`).toBe(401);
        expect(await r.json(), `${label}: ${m} ${path}`).toEqual({ error: 'unauthorized' });
      }
      expect(await snapshot(), label).toEqual(before);
    };

    await check('no cookie', {});
    await check('no cookie + csrf', { 'X-CSRF-Token': h['X-CSRF-Token'] });
    await check('garbage cookie', { Cookie: `${cookieName}=not-a-real-session-token`, 'X-CSRF-Token': h['X-CSRF-Token'] });

    // Expiry: the session is refused (and revoked on use).
    await env.DB.prepare('UPDATE sessions SET expires_at = 1 WHERE user_id = ?1').bind(u.id).run();
    await check('expired session', h);

    // Revoked: a second account's real session (its own TOTP secret, so no replay refusal), revoked server-side.
    const v = await makeUser('other@example.test');
    const hv = await login(v);
    expect((await req('PUT', '/tx-requests/tx-other', { status: 'sent' }, hv)).status).toBe(200); // control: valid session writes
    await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?1').bind(v.id).run();
    await check('revoked session', hv);
  });
});
