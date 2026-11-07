// users.email: HMAC blind index + encrypted address. Legacy plaintext rows are a fixture here only,
// standing in for rows written before 0014 was sealed by the Worker.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authenticator } from 'otplib';
import worker from '../src/index.js';
import { b64, emailHmac, encryptStr, hashPassword, EmailKeyError } from '../src/crypto.js';
import { decryptUserEmail, backfillUserEmails, findUserByEmail, sealStoredEmail, userEmailFields } from '../src/userEmail.js';
import { inactiveAccounts } from '../src/app.js';
import { loadInternalKeys } from '../src/internalAuth.js';
import { insertUserRow } from './userFixture.js';

const ORIGIN = 'http://localhost:5173';
const BASE = 'https://api.test';
const PASSWORD = 'correct horse battery';
const DAY = 86400;
const T = 2_000_000_000;
let n = 0;
const ip = () => `10.64.${Math.floor(++n / 250)}.${n % 250}`;

const post = (path, body, IP, headers = {}) => SELF.fetch(BASE + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': IP, ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const cookieOf = (res) => (res.headers.get('Set-Cookie') || '').split(';')[0];

async function legacyUser(email, { totp = true } = {}) {
  const id = crypto.randomUUID();
  const secret = authenticator.generateSecret(20);
  await env.DB.prepare(
    'INSERT INTO users (id, email, pw_hash, totp_secret_enc, totp_enabled, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 1)',
  ).bind(id, email, await hashPassword(PASSWORD), totp ? await encryptStr(env, secret) : null, totp ? 1 : 0).run();
  return { id, email, secret };
}

beforeEach(async () => {
  await env.DB.batch(['sessions', 'users', 'rate_limits'].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});

describe('users.email blind index', () => {
  it('lookup uses the HMAC of the normalized address and does not keep the address', async () => {
    const id = crypto.randomUUID();
    const secret = authenticator.generateSecret(20);
    await insertUserRow(env, {
      id, email: '  Pat@Example.TEST ', pwHash: await hashPassword(PASSWORD),
      totpSecretEnc: await encryptStr(env, secret), totpEnabled: true,
    });
    const hmac = await emailHmac(env, 'pat@example.test');
    expect(await emailHmac(env, 'PAT@example.test')).toBe(hmac);
    const row = await env.DB.prepare('SELECT email, email_hmac, email_enc, email_key_version, email_placeholder FROM users WHERE id = ?1').bind(id).first();
    expect(row.email_hmac).toBe(hmac);
    expect(row.email).toBe(hmac);
    expect(row.email_enc).not.toContain('@');
    expect(row.email_placeholder).toBe(0);
    expect(row.email_key_version).toBe(1);
    expect(await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind('pat@example.test').first()).toBeNull();
    expect(await decryptUserEmail(env, { id, email_enc: row.email_enc, email_key_version: row.email_key_version })).toBe('pat@example.test');

    const IP = ip();
    const r = await post('/auth/login', { email: 'PAT@example.test', password: PASSWORD }, IP);
    expect(r.status).toBe(200);
    const wrong = await post('/auth/login', { email: 'pat@example.test', password: 'nope' }, ip());
    const unknown = await post('/auth/login', { email: 'nobody@example.test', password: 'nope' }, ip());
    expect(wrong.status).toBe(unknown.status);
    expect(await wrong.text()).toBe(await unknown.text());
  });

  it('GET /me and TOTP enrollment decrypt the address', async () => {
    const id = crypto.randomUUID();
    await insertUserRow(env, { id, email: 'Pat@Example.test', pwHash: await hashPassword(PASSWORD), totpEnabled: false });
    const IP = ip();
    const r = await post('/auth/login', { email: 'pat@example.test', password: PASSWORD }, IP);
    expect(r.status).toBe(200);
    const body = await r.json();
    const cookie = cookieOf(r);
    const me = await (await SELF.fetch(BASE + '/me', { headers: { Origin: ORIGIN, 'CF-Connecting-IP': IP, Cookie: cookie } })).json();
    expect(me.email).toBe('pat@example.test');
    const stored = await env.DB.prepare('SELECT email_hmac, email_enc FROM users WHERE id = ?1').bind(id).first();
    expect(JSON.stringify(me)).not.toContain(stored.email_hmac);
    expect(JSON.stringify(me)).not.toContain(stored.email_enc);
    const en = await post('/auth/totp/enroll', undefined, IP, { Cookie: cookie, 'X-CSRF-Token': body.csrf_token });
    expect(en.status).toBe(200);
    expect(decodeURIComponent((await en.json()).otpauth_url)).toContain('pat@example.test');
  });

  it('seals a pre-existing plaintext row on login and on the one-shot backfill', async () => {
    const u = await legacyUser('Legacy@Example.test');
    expect(await env.DB.prepare('SELECT id FROM users WHERE email = ?1 AND email_enc IS NULL').bind('Legacy@Example.test').first()).not.toBeNull();
    const r = await post('/auth/login', { email: 'legacy@example.test', password: PASSWORD }, ip());
    expect(r.status).toBe(200);
    const row = await env.DB.prepare('SELECT email, email_hmac, email_enc, email_key_version FROM users WHERE id = ?1').bind(u.id).first();
    expect(row.email).toBe(await emailHmac(env, 'legacy@example.test'));
    expect(row.email_hmac).toBe(row.email);
    expect(row.email_enc).not.toContain('@');
    expect(await decryptUserEmail(env, { id: u.id, ...row })).toBe('legacy@example.test');
    expect(await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind('legacy@example.test').first()).toBeNull();
    expect((await post('/auth/login', { email: 'LEGACY@example.test', password: PASSWORD }, ip())).status).toBe(200);

    const other = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO users (id, email, pw_hash, created_at) VALUES (?1, ?2, ?3, 1)',
    ).bind(other, 'plain@example.test', await hashPassword(PASSWORD)).run();
    expect(await backfillUserEmails(env)).toEqual({ sealed: 1, skipped: 0 });
    const sealed = await env.DB.prepare('SELECT email, email_hmac, email_enc, email_key_version FROM users WHERE id = ?1').bind(other).first();
    expect(sealed.email_hmac).toBe(await emailHmac(env, 'plain@example.test'));
    expect(sealed.email).toBe(sealed.email_hmac);
    expect(await decryptUserEmail(env, { id: other, ...sealed })).toBe('plain@example.test');
    expect(await backfillUserEmails(env)).toEqual({ sealed: 0, skipped: 0 });
  });

  it('fails closed when the HMAC key is missing or reused, and does not write the address', async () => {
    const id = crypto.randomUUID();
    await insertUserRow(env, { id, email: 'kept@example.test', pwHash: await hashPassword(PASSWORD), totpEnabled: true });
    const headers = { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip() };
    const logged = [];
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((k) => vi.spyOn(console, k).mockImplementation((...a) => logged.push(a.map(String).join(' '))));
    try {
      const missing = await worker.fetch(new Request(BASE + '/auth/login', {
        method: 'POST', headers, body: JSON.stringify({ email: 'kept@example.test', password: PASSWORD }),
      }), { ...env, EMAIL_HMAC_KEY: '' });
      const unknown = await worker.fetch(new Request(BASE + '/auth/login', {
        method: 'POST', headers: { ...headers, 'CF-Connecting-IP': ip() }, body: JSON.stringify({ email: 'nobody@example.test', password: PASSWORD }),
      }), { ...env, EMAIL_HMAC_KEY: '' });
      expect(missing.status).toBe(401);
      expect(await missing.text()).toBe(await unknown.text());
    } finally { spies.forEach((s) => s.mockRestore()); }
    expect(logged.join('\n')).not.toContain('kept@example.test');
    expect(logged.join('\n')).toContain('EmailKeyError');
    const still = await env.DB.prepare('SELECT email, email_enc FROM users WHERE id = ?1').bind(id).first();
    expect(still.email).not.toContain('@');
    expect(still.email_enc).not.toContain('@');

    await env.DB.prepare('DELETE FROM users').run();
    const bootBody = JSON.stringify({ email: 'new@example.test', password: PASSWORD });
    const bootHeaders = { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip(), Authorization: `Bearer ${env.ADMIN_BOOTSTRAP_TOKEN}` };
    const noKey = await worker.fetch(new Request(BASE + '/admin/bootstrap', { method: 'POST', headers: bootHeaders, body: bootBody }), { ...env, EMAIL_HMAC_KEY: '' });
    expect(noKey.status).toBe(500);
    expect(await noKey.text()).not.toContain('new@example.test');
    expect(await env.DB.prepare('SELECT 1 FROM users').first()).toBeNull();
    const reused = await worker.fetch(new Request(BASE + '/admin/bootstrap', {
      method: 'POST', headers: { ...bootHeaders, 'CF-Connecting-IP': ip() }, body: bootBody,
    }), { ...env, EMAIL_HMAC_KEY: env.PII_ENC_KEY });
    expect(reused.status).toBe(500);
    expect(await reused.text()).not.toContain('new@example.test');
    expect(await env.DB.prepare('SELECT 1 FROM users').first()).toBeNull();
    await expect(userEmailFields({ ...env, PII_ENC_KEY: '' }, crypto.randomUUID(), 'new@example.test')).rejects.toThrow();
    await expect(userEmailFields({ ...env, EMAIL_HMAC_KEY: env.PII_ENC_KEY }, crypto.randomUUID(), 'new@example.test')).rejects.toBeInstanceOf(EmailKeyError);
    await env.DB.prepare('INSERT INTO users (id, email, pw_hash, created_at) VALUES (?1, ?2, ?3, 1)')
      .bind('stay-plain', 'stay@example.test', 'x').run();
    await expect(backfillUserEmails({ ...env, EMAIL_HMAC_KEY: '' })).rejects.toBeInstanceOf(EmailKeyError);
    const stayed = await env.DB.prepare('SELECT email, email_enc FROM users WHERE id = ?1').bind('stay-plain').first();
    expect(stayed.email).toBe('stay@example.test');
    expect(stayed.email_enc).toBeNull();
  });

  it('seals placeholder social addresses and still skips them for inactivity mail', async () => {
    const id = crypto.randomUUID();
    const placeholder = `${id}@users.invalid`;
    await insertUserRow(env, {
      id, email: placeholder, pwHash: '!', createdAt: 1, lastActiveAt: T - 400 * DAY,
    });
    const row = await env.DB.prepare('SELECT email, email_hmac, email_enc, email_placeholder, email_key_version FROM users WHERE id = ?1').bind(id).first();
    expect(row.email_placeholder).toBe(1);
    expect(row.email).toBe(await emailHmac(env, placeholder));
    expect(row.email_enc).not.toContain('@');
    expect(await decryptUserEmail(env, { id, ...row })).toBe(placeholder);
    const denied = await post('/api/auth/login', { email: placeholder, password: '!' }, ip());
    expect(denied.status).toBe(401);
    expect(await denied.text()).toBe('{"error":"invalid credentials"}');

    const plainId = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO users (id, email, pw_hash, created_at, last_active_at) VALUES (?1, ?2, ?3, 1, ?4)',
    ).bind(plainId, `${plainId}@users.invalid`, 'x', T - 400 * DAY).run();
    const send = vi.fn(async () => ({}));
    await insertUserRow(env, {
      id: crypto.randomUUID(), email: 'year@example.test', pwHash: 'x', createdAt: 1, lastActiveAt: T - 400 * DAY,
    });
    await inactiveAccounts({ ...env, MAILER: { send }, MAIL_FROM: 'a@example.test', INACTIVE_WARN_DAYS: '365', INACTIVE_DELETE_DAYS: '395' }, T);
    expect(send.mock.calls.map((c) => c[0].to)).toEqual(['year@example.test']);
    const unsealed = await env.DB.prepare('SELECT email_placeholder, email_enc FROM users WHERE id = ?1').bind(plainId).first();
    expect(unsealed.email_enc).toBeNull();
    expect(unsealed.email_placeholder).toBe(0);
    expect((await backfillUserEmails(env)).sealed).toBe(1);
    const sealedPlain = await env.DB.prepare('SELECT email, email_enc, email_placeholder, email_key_version FROM users WHERE id = ?1').bind(plainId).first();
    expect(sealedPlain.email_placeholder).toBe(1);
    expect(sealedPlain.email).not.toContain('@');
    expect(await decryptUserEmail(env, { id: plainId, ...sealedPlain })).toBe(`${plainId}@users.invalid`);
    await inactiveAccounts({ ...env, MAILER: { send }, MAIL_FROM: 'a@example.test', INACTIVE_WARN_DAYS: '365', INACTIVE_DELETE_DAYS: '395' }, T);
    expect(send.mock.calls.map((c) => c[0].to)).toEqual(['year@example.test']);
  });

  it('rejects a missing HMAC key and every reused-secret encoding before lookup or seal', async () => {
    const id = 'reuse-row';
    await env.DB.prepare('INSERT INTO users (id, email, pw_hash, created_at) VALUES (?1, ?2, ?3, 1)')
      .bind(id, 'reuse@example.test', 'x').run();
    const stillPlain = async () => {
      const row = await env.DB.prepare('SELECT email, email_enc FROM users WHERE id = ?1').bind(id).first();
      expect(row.email).toBe('reuse@example.test');
      expect(row.email_enc).toBeNull();
    };
    const encodings = (canonical) => {
      const stripped = canonical.replace(/=+$/, '');
      return [canonical, stripped, ` ${canonical} `, `\n${canonical}\n`, `\t${stripped}\r\n`, ` \n${stripped} `];
    };
    const assertClosed = async (override, message) => {
      const bad = { ...env, ...override };
      await expect(emailHmac(bad, 'reuse@example.test')).rejects.toThrow(message);
      await expect(userEmailFields(bad, id, 'reuse@example.test')).rejects.toBeInstanceOf(EmailKeyError);
      await expect(sealStoredEmail(bad, id, 'reuse@example.test')).rejects.toBeInstanceOf(EmailKeyError);
      expect(await findUserByEmail(bad, 'reuse@example.test')).toBeNull();
      await stillPlain();
    };

    await assertClosed({ EMAIL_HMAC_KEY: '' }, /not configured/);
    await assertClosed({ EMAIL_HMAC_KEY: undefined }, /not configured/);

    const byteSecrets = {
      PII_ENC_KEY: env.PII_ENC_KEY,
      PII_ENC_KEY_PREV: b64(new Uint8Array(32).fill(4)),
      TOTP_ENC_KEY: env.TOTP_ENC_KEY,
      OAUTH_COOKIE_KEY: env.OAUTH_COOKIE_KEY,
      SIGNUP_PII_KEY: b64(new Uint8Array(32).fill(5)),
    };
    for (const [name, canonical] of Object.entries(byteSecrets)) {
      for (const encoded of encodings(canonical)) {
        await assertClosed({ [name]: canonical, EMAIL_HMAC_KEY: encoded }, /dedicated key/);
        if (encoded !== canonical) await assertClosed({ [name]: encoded, EMAIL_HMAC_KEY: canonical }, /dedicated key/);
      }
    }

    await assertClosed({ EMAIL_HMAC_KEY: env.API_TOKEN }, /dedicated key/);
    await assertClosed({ EMAIL_HMAC_KEY: env.ADMIN_BOOTSTRAP_TOKEN }, /dedicated key/);
    const opaque = b64(new Uint8Array(32).fill(9));
    await assertClosed({ API_TOKEN: opaque, EMAIL_HMAC_KEY: opaque }, /dedicated key/);
    await assertClosed({ ADMIN_BOOTSTRAP_TOKEN: opaque, EMAIL_HMAC_KEY: opaque }, /dedicated key/);

    await expect(backfillUserEmails({ ...env, EMAIL_HMAC_KEY: env.PII_ENC_KEY.replace(/=+$/, '') })).rejects.toThrow(/dedicated key/);
    await stillPlain();
    expect(await emailHmac(env, 'reuse@example.test')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses an internal proxy key that copies EMAIL_HMAC_KEY', () => {
    const key = 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=';
    expect(loadInternalKeys({ INTERNAL_PROXY_KEYS: JSON.stringify({ a: key }), EMAIL_HMAC_KEY: key }).size).toBe(0);
  });
});
