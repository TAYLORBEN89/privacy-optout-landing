import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';
import { buildList, saveList, ingestStatus, sha256HexOf } from '../src/hashEngine.js';
import { issueCredential, revokeCredential, authenticateBroker, monthlyLists, brokerPurge, periodOf, loadSignupRecords, credentialKeyReport, finishSignups } from '../src/brokerDelivery.js';
import { purge } from '../src/app.js';
import { encryptPii } from '../src/crypto.js';
import { insertUserRow } from './userFixture.js';

const DAY = 86400;
const NOW = () => Math.floor(Date.now() / 1000);
const call = (path, { method = 'GET', token, body, headers = {} } = {}) => worker.fetch(new Request(`https://api.test${path}`, {
  method, body, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
}), env);
const admin = (path, body) => call(path, { method: 'POST', token: 'test-legacy-token', body: JSON.stringify(body || {}), headers: { 'Content-Type': 'application/json' } });
const addBroker = (id, types = 'email,phone,ndz') => env.DB.prepare('INSERT INTO delivery_brokers (broker_id, list_types, enabled, created_at) VALUES (?1, ?2, 1, ?3)').bind(id, types, NOW()).run();
let seq = 0;
const ids = () => `ID${String(++seq).padStart(6, '0')}`;
async function makeList(broker, { createdAt = NOW(), version = 1, records } = {}) {
  const out = await buildList({ brokerId: broker, listType: 'email', version, createdAt, idGen: ids,
    records: records || [{ request_ref: `${broker}-r1`, email: `a@${broker}.example` }, { request_ref: `${broker}-r2`, email: `b@${broker}.example` }] });
  await saveList(env, out);
  return out;
}

describe('credentials', () => {
  it('stores only an HMAC, shows the token once, authenticates, rotates and revokes', async () => {
    await addBroker('cred-a');
    const c = await issueCredential(env, 'cred-a');
    expect(c.token).toMatch(/^dtb\.bk_[0-9a-f]{16}\.[A-Za-z0-9_-]{43}$/);
    const row = await env.DB.prepare('SELECT * FROM broker_credentials WHERE kid = ?1').bind(c.kid).first();
    expect(JSON.stringify(row)).not.toContain(c.token.split('.')[2]);
    expect(row.secret_hmac).toMatch(/^[0-9a-f]{64}$/);
    const req = (t) => new Request('https://api.test/broker/v1/lists', { headers: { Authorization: `Bearer ${t}` } });
    expect(await authenticateBroker(env, req(c.token))).toEqual({ kid: c.kid, broker_id: 'cred-a' });
    expect(await authenticateBroker(env, req(c.token.slice(0, -1) + (c.token.endsWith('A') ? 'B' : 'A')))).toBeNull();
    expect(await authenticateBroker(env, req('dtb.bk_0123456789abcdef.' + 'A'.repeat(43)))).toBeNull();
    const c2 = await issueCredential(env, 'cred-a'); // rotation: new one first, then revoke old
    expect(await revokeCredential(env, 'cred-a', c.kid)).toBe(true);
    expect(await authenticateBroker(env, req(c.token))).toBeNull();
    expect(await authenticateBroker(env, req(c2.token))).not.toBeNull();
    await expect(env.DB.prepare('UPDATE broker_credentials SET revoked_at = NULL WHERE kid = ?1').bind(c.kid).run()).rejects.toThrow(/only revocation/);
    await expect(env.DB.prepare('DELETE FROM broker_credentials WHERE kid = ?1').bind(c.kid).run()).rejects.toThrow(/revoke/);
    expect(await authenticateBroker(env, req(c.token), NOW() + 400 * DAY)).toBeNull(); // expired
  });
  it('admin routes need API_TOKEN; issued secret is in the response only', async () => {
    expect((await call('/admin/broker-delivery/brokers', { method: 'POST', token: 'nope', body: '{}' })).status).toBe(401);
    expect((await admin('/admin/broker-delivery/brokers', { broker_id: 'Bad Id' })).status).toBe(400);
    const r = await admin('/admin/broker-delivery/brokers', { broker_id: 'adm-b', list_types: 'email,ndz' });
    expect(r.status).toBe(200);
    const issued = await admin('/admin/broker-delivery/brokers/adm-b/credentials');
    expect(issued.status).toBe(201);
    expect(issued.headers.get('Cache-Control')).toBe('no-store');
    const { kid, token } = await issued.json();
    expect(token).toContain(kid);
    const audit = JSON.stringify((await env.DB.prepare("SELECT detail FROM broker_hash_audit WHERE broker_id = 'adm-b'").all()).results);
    expect(audit).not.toContain(token.split('.')[2]);
    expect((await admin(`/admin/broker-delivery/brokers/adm-b/credentials/${kid}/revoke`)).status).toBe(200);
    expect((await admin(`/admin/broker-delivery/brokers/adm-b/credentials/${kid}/revoke`)).status).toBe(404);
    expect((await admin('/admin/broker-delivery/brokers/nobody/credentials')).status).toBe(404);
  });
});

describe('secure download API', () => {
  it('own lists only, CSV matches manifest sha256, download audited, uniform errors, no-store', async () => {
    await addBroker('dl-a'); await addBroker('dl-b');
    const a = await issueCredential(env, 'dl-a');
    const b = await issueCredential(env, 'dl-b');
    const la = await makeList('dl-a');
    await makeList('dl-b');
    const lists = await (await call('/broker/v1/lists', { token: a.token })).json();
    expect(lists.lists.map((l) => l.list_id)).toEqual(['dl-a-email-v1']);
    const f = await call('/broker/v1/lists/dl-a-email-v1/file', { token: a.token });
    expect(f.status).toBe(200);
    expect(f.headers.get('Cache-Control')).toBe('no-store');
    expect(f.headers.get('Content-Disposition')).toMatch(/droptx_dl-a-email-v1_\d{8}\.csv/);
    const csv = await f.text();
    expect(csv).toBe(la.csv);
    expect(await sha256HexOf(csv)).toBe(f.headers.get('X-Content-SHA256'));
    expect(csv).not.toMatch(/@|example|dl-a-r/);
    const man = await (await call('/broker/v1/lists/dl-a-email-v1/manifest', { token: a.token })).json();
    expect(man.sha256).toBe(la.manifest.sha256);
    // other broker's list, unknown list, no token: same bodies
    const other = await call('/broker/v1/lists/dl-a-email-v1/file', { token: b.token });
    const missing = await call('/broker/v1/lists/nope-email-v1/file', { token: b.token });
    expect(other.status).toBe(404);
    expect(await other.text()).toBe(await missing.text());
    expect((await call('/broker/v1/lists')).status).toBe(401);
    const ev = (await env.DB.prepare("SELECT detail FROM broker_hash_audit WHERE list_id = 'dl-a-email-v1' AND event = 'list.downloaded'").all()).results;
    expect(ev).toHaveLength(1);
    expect(JSON.parse(ev[0].detail)).toEqual({ kid: a.kid, rows: 2, via: 'bearer' });
    expect((await worker.fetch(new Request('http://api.test/broker/v1/lists', { headers: { Authorization: `Bearer ${a.token}` } }), env)).status).toBe(403); // HTTPS only
  });
  it('short-lived signed links: work once issued, bound to list/broker/kid, expire, die on revoke', async () => {
    await addBroker('sl-a');
    const a = await issueCredential(env, 'sl-a');
    await makeList('sl-a');
    const { url, expires_at } = await (await call('/broker/v1/lists/sl-a-email-v1/link', { method: 'POST', token: a.token })).json();
    expect(expires_at - NOW()).toBeLessThanOrEqual(300);
    const path = url.replace('https://api.test', '');
    expect((await call(path)).status).toBe(200);
    expect((await call(path.replace('sl-a-email-v1', 'sl-a-email-v2'))).status).toBe(401);
    expect((await call(path.replace(/sig=[0-9a-f]+/, `sig=${'0'.repeat(64)}`))).status).toBe(401);
    await revokeCredential(env, 'sl-a', a.kid);
    expect((await call(path)).status).toBe(401);
  });
  it('incomplete lists (crash between chunks) are never served', async () => {
    await addBroker('inc-a');
    const a = await issueCredential(env, 'inc-a');
    const out = await buildList({ brokerId: 'inc-a', listType: 'email', version: 1, createdAt: NOW(), idGen: ids, records: [{ request_ref: 'x1', email: 'x1@x.example' }, { request_ref: 'x2', email: 'x2@x.example' }] });
    const m = out.manifest;
    await env.DB.batch([
      env.DB.prepare('INSERT INTO broker_lists (list_id, broker_id, list_type, version, created_at, response_due, row_count, sha256) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(m.list_id, m.broker_id, m.list_type, m.version, m.created_at, m.response_due, m.row_count, m.sha256),
      env.DB.prepare('INSERT INTO broker_list_items (list_id, item_id, request_ref, hash) VALUES (?1, ?2, ?3, ?4)').bind(m.list_id, out.items[0].item_id, 'x1', out.items[0].hash),
    ]);
    expect((await call('/broker/v1/lists/inc-a-email-v1/file', { token: a.token })).status).toBe(404);
  });
  it('status upload: broker comes from the credential only; version required', async () => {
    await addBroker('st-a'); await addBroker('st-b');
    const a = await issueCredential(env, 'st-a');
    const b = await issueCredential(env, 'st-b');
    const l = await makeList('st-a');
    const id0 = l.items[0].item_id;
    const body = `Id,Status\n${id0},3\n`;
    expect((await call('/broker/v1/lists/st-a-email-v1/status?version=1', { method: 'POST', token: b.token, body })).status).toBe(404);
    expect((await call('/broker/v1/lists/st-a-email-v1/status', { method: 'POST', token: a.token, body })).status).toBe(422);
    const r = await call('/broker/v1/lists/st-a-email-v1/status?version=1&broker_id=st-b', { method: 'POST', token: a.token, body });
    expect(r.status).toBe(200);
    expect((await r.json()).accepted).toBe(1);
    await expect(ingestStatus(env, { listId: 'st-a-email-v1', version: 1, csv: body, now: NOW() })).rejects.toThrow(/credential/);
  });
});

describe('duplicate hashes', () => {
  it('two requests with the same hash share one Id; both refs stored; one status covers both', async () => {
    await addBroker('dup-a');
    const out = await makeList('dup-a', { records: [
      { request_ref: 'dup-r1', email: 'Same@dup.example' }, { request_ref: 'dup-r2', email: ' same@dup.example ' }, { request_ref: 'dup-r3', email: 'other@dup.example' }] });
    expect(out.manifest.row_count).toBe(2);
    const refs = (await env.DB.prepare('SELECT item_id, request_ref FROM broker_list_refs WHERE list_id = ?1 ORDER BY request_ref').bind('dup-a-email-v1').all()).results;
    expect(refs.map((r) => r.request_ref)).toEqual(['dup-r1', 'dup-r2', 'dup-r3']);
    expect(refs[0].item_id).toBe(refs[1].item_id);
    await ingestStatus(env, { credential: { kid: 'bk_t', broker_id: 'dup-a' }, listId: 'dup-a-email-v1', version: 1, csv: `Id,Status\n${refs[0].item_id},3\n`, now: NOW() });
    const per = (await env.DB.prepare(
      'SELECT r.request_ref, s.status FROM broker_list_refs r JOIN broker_status s ON s.list_id = r.list_id AND s.item_id = r.item_id WHERE r.list_id = ?1 ORDER BY r.request_ref',
    ).bind('dup-a-email-v1').all()).results;
    expect(per).toEqual([{ request_ref: 'dup-r1', status: 3 }, { request_ref: 'dup-r2', status: 3 }]);
  });
  it('saveList chunks large lists across several batches', async () => {
    await addBroker('big-a');
    const records = Array.from({ length: 130 }, (_, i) => ({ request_ref: `big-${i}`, email: `p${i}@big.example` }));
    const out = await buildList({ brokerId: 'big-a', listType: 'email', version: 1, createdAt: NOW(), idGen: ids, records });
    let batches = 0;
    const spy = { ...env, DB: new Proxy(env.DB, { get: (t, k) => (k === 'batch' ? (s) => { batches++; return t.batch(s); } : (typeof t[k] === 'function' ? t[k].bind(t) : t[k])) }) };
    await saveList(spy, out, { chunk: 50 });
    expect(batches).toBe(Math.ceil((1 + 130 * 2 + 1) / 50)); // list.generated rides in the last chunk
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM broker_list_items WHERE list_id = ?1').bind('big-a-email-v1').first();
    expect(n.n).toBe(130);
  });
});

describe('monthly scheduler', () => {
  it('builds next version per broker/type, idempotent within a month, +45 days, only new requests next month', async () => {
    await addBroker('mo-a', 'email,phone');
    const recs = { email: [{ request_ref: 'mo-1', email: 'm1@mo.example' }], phone: [{ request_ref: 'mo-1', phone: '512-555-0100' }] };
    const load = async (_e, b, t) => (b === 'mo-a' ? recs[t] : []);
    const at = Date.UTC(2026, 10, 1, 9) / 1000;
    const c1 = await monthlyLists(env, at, { loadRecords: load });
    expect(c1.built).toBeGreaterThanOrEqual(2);
    const again = await monthlyLists(env, at + 3600, { loadRecords: load });
    expect(again.built).toBe(0);
    const rows = (await env.DB.prepare("SELECT list_id, version, response_due, created_at FROM broker_lists WHERE broker_id = 'mo-a' ORDER BY list_id").all()).results;
    expect(rows.map((r) => r.list_id)).toEqual(['mo-a-email-v1', 'mo-a-phone-v1']);
    for (const r of rows) expect(r.response_due - r.created_at).toBe(45 * DAY);
    const dec = Date.UTC(2026, 11, 1, 9) / 1000;
    expect(periodOf(dec)).toBe('202612');
    await monthlyLists(env, dec, { loadRecords: load });
    const v2 = await env.DB.prepare("SELECT version FROM broker_lists WHERE broker_id = 'mo-a' AND list_type = 'email' ORDER BY version DESC").first();
    expect(v2.version).toBe(2);
  });
  it('default loader decrypts signup payloads in memory and skips already-listed requests', async () => {
    await addBroker('ld-a', 'email');
    const t = NOW();
    await insertUserRow(env, { id: 'ld-user', email: 'ld-owner@ld.example', pwHash: 'x', createdAt: t }).catch(() => {});
    const u = await env.DB.prepare("SELECT id FROM users WHERE id = 'ld-user'").first();
    expect(u).not.toBeNull();
    const id = 'ld-req-1';
    await env.DB.prepare("INSERT INTO optout_requests (id, user_id, status, created_at, updated_at, kind, service_id) VALUES (?1, 'ld-user', 'queued', ?2, ?2, 'tx', 'signup')").bind(id, t).run();
    const { blob, version } = await encryptPii(env, JSON.stringify({ v: 2, firstName: 'Ana', lastName: 'Ruiz', dob: '1990-01-12', zip: '78701', email: 'ana@ld.example', phone: '5125550101', submitter: 'self' }), `pii:${id}`);
    await env.DB.prepare('INSERT INTO pii_payloads (request_id, payload_enc, key_version, created_at, purge_after) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, blob, version, t, t + 90 * DAY).run();
    const r1 = await loadSignupRecords(env, 'ld-a', 'email');
    expect(r1.map((r) => r.request_ref)).toContain(id);
    await monthlyLists(env, t);
    const r2 = await loadSignupRecords(env, 'ld-a', 'email');
    expect(r2.map((r) => r.request_ref)).not.toContain(id);
  });
});

describe('retention purge (gated, 24 months)', () => {
  it('dry run counts and deletes nothing; real run deletes only rows older than the cutoff; audited with counts', async () => {
    const t = NOW();
    await addBroker('pg-a');
    const old = await makeList('pg-a', { createdAt: t - 830 * DAY, version: 1 });
    const mixed = await makeList('pg-a', { createdAt: t - 825 * DAY, version: 2, records: [{ request_ref: 'pg-m1', email: 'm1@pg.example' }, { request_ref: 'pg-m2', email: 'm2@pg.example' }] });
    const young = await makeList('pg-a', { createdAt: t - 10 * DAY, version: 3 });
    const ins = (l, item, at) => env.DB.prepare('INSERT INTO broker_status (list_id, item_id, status, received_at) VALUES (?1, ?2, 3, ?3)').bind(l, item, at).run();
    await ins(old.manifest.list_id, old.items[0].item_id, t - 800 * DAY);       // old status -> purged
    await ins(mixed.manifest.list_id, mixed.items[0].item_id, t - 100 * DAY);   // young status on an old list -> kept
    await ins(young.manifest.list_id, young.items[0].item_id, t - 5 * DAY);
    const dry = await brokerPurge(env, t, { dryRun: true });
    expect(dry.counts.status).toBe(1);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM broker_lists WHERE broker_id = 'pg-a'").first()).n).toBe(3);
    const r = await brokerPurge(env, t);
    expect(r.counts.status).toBe(1);
    const lists = (await env.DB.prepare("SELECT list_id FROM broker_lists WHERE broker_id = 'pg-a' ORDER BY list_id").all()).results.map((x) => x.list_id);
    expect(lists).toEqual(['pg-a-email-v2', 'pg-a-email-v3']);
    const items = (await env.DB.prepare("SELECT list_id, item_id FROM broker_list_items WHERE list_id LIKE 'pg-a-%' ORDER BY list_id").all()).results;
    expect(items.filter((i) => i.list_id === 'pg-a-email-v2').map((i) => i.item_id)).toEqual([mixed.items[0].item_id]);
    expect(items.filter((i) => i.list_id === 'pg-a-email-v3')).toHaveLength(2);
    expect(await env.DB.prepare('SELECT 1 FROM maintenance_gate').first()).toBeNull();
    const a = await env.DB.prepare("SELECT detail FROM broker_hash_audit WHERE event = 'purge.completed' ORDER BY id DESC").first();
    expect(Object.keys(JSON.parse(a.detail)).sort()).toEqual(['audit', 'cutoff', 'items', 'lists', 'refs', 'status']);
    expect(a.detail).not.toMatch(/@|pg-/);
  });
  it('nothing younger than the cutoff can be deleted, even by bypassing the job', async () => {
    const t = NOW();
    await addBroker('by-a');
    const l = await makeList('by-a', { createdAt: t - 5 * DAY });
    await env.DB.prepare('INSERT INTO broker_status (list_id, item_id, status, received_at) VALUES (?1, ?2, 3, ?3)').bind(l.manifest.list_id, l.items[0].item_id, t - DAY).run();
    // 1) no gate
    for (const sql of ['DELETE FROM broker_status WHERE list_id = ?1', 'DELETE FROM broker_list_refs WHERE list_id = ?1', 'DELETE FROM broker_list_items WHERE list_id = ?1', 'DELETE FROM broker_lists WHERE list_id = ?1', 'DELETE FROM broker_hash_audit WHERE list_id = ?1']) {
      await expect(env.DB.prepare(sql).bind(l.manifest.list_id).run(), sql).rejects.toThrow(/write-once|append-only/);
    }
    // 2) a gate with a recent cutoff is refused by the database clock, even with a far-future "now"
    await expect(env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('broker_purge', ?1)").bind(t).run()).rejects.toThrow(/too recent/);
    await expect(brokerPurge(env, t + 10000 * DAY)).rejects.toThrow(/too recent/);
    await expect(env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('other', 0)").run()).rejects.toThrow(/unknown gate/);
    // 3) a valid (old) gate still doesn't let young rows go; the batch rolls back and the gate is not left open
    await expect(env.DB.batch([
      env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('broker_purge', ?1)").bind(t - 731 * DAY),
      env.DB.prepare('DELETE FROM broker_status WHERE list_id = ?1').bind(l.manifest.list_id),
    ])).rejects.toThrow(/write-once/);
    await expect(env.DB.batch([
      env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('broker_purge', ?1)").bind(t - 731 * DAY),
      env.DB.prepare('DELETE FROM broker_lists WHERE list_id = ?1').bind(l.manifest.list_id),
    ])).rejects.toThrow(/write-once/);
    expect(await env.DB.prepare('SELECT 1 FROM maintenance_gate').first()).toBeNull();
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM broker_list_items WHERE list_id = ?1').bind(l.manifest.list_id).first()).n).toBe(2);
    // 4) audit-expiry gate is unchanged (365 days)
    await expect(env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('audit_expiry', ?1)").bind(t - 10 * DAY).run()).rejects.toThrow(/too recent/);
  });
});

describe('server-key rotation (BROKER_CRED_KEYS + BROKER_CRED_ACTIVE_KID)', () => {
  const req = (t) => new Request('https://api.test/broker/v1/lists', { headers: { Authorization: `Bearer ${t}` } });
  const row = (kid) => env.DB.prepare('SELECT key_kid, secret_hmac FROM broker_credentials WHERE kid = ?1').bind(kid).first();
  it('old-kid credential verifies, is re-wrapped to the active kid, and keeps working', async () => {
    await addBroker('rot-a');
    const c = await issueCredential(env, 'rot-a'); // active t1
    const before = await row(c.kid);
    expect(before.key_kid).toBe('t1');
    const rotated = { ...env, BROKER_CRED_ACTIVE_KID: 't2' };
    const rep0 = await credentialKeyReport(rotated);
    expect(rep0.active_kid).toBe('t2');
    expect(rep0.on_old_kids).toBeGreaterThanOrEqual(1);
    expect(await authenticateBroker(rotated, req(c.token))).toEqual({ kid: c.kid, broker_id: 'rot-a' });
    const after = await row(c.kid);
    expect(after.key_kid).toBe('t2');
    expect(after.secret_hmac).not.toBe(before.secret_hmac);
    const ev = await env.DB.prepare("SELECT detail FROM broker_hash_audit WHERE event = 'credential.rewrapped' AND broker_id = 'rot-a'").first();
    expect(JSON.parse(ev.detail)).toEqual({ kid: c.kid, from: 't1', to: 't2' });
    // old key removed: the re-wrapped credential still works
    const onlyNew = { ...env, BROKER_CRED_KEYS: JSON.stringify({ t2: JSON.parse(env.BROKER_CRED_KEYS).t2 }), BROKER_CRED_ACTIVE_KID: 't2' };
    expect(await authenticateBroker(onlyNew, req(c.token))).not.toBeNull();
    expect((await credentialKeyReport(onlyNew)).live_by_kid['t1'] || 0).toBe((await credentialKeyReport(onlyNew)).on_old_kids);
    // and new credentials are issued on the active kid
    expect((await row((await issueCredential(rotated, 'rot-a')).kid)).key_kid).toBe('t2');
  });
  it('a credential whose key was removed fails; an unknown key kid fails; a bad active kid refuses to issue', async () => {
    await addBroker('rot-b');
    const c = await issueCredential(env, 'rot-b'); // on t1
    const removed = { ...env, BROKER_CRED_KEYS: JSON.stringify({ t2: JSON.parse(env.BROKER_CRED_KEYS).t2 }), BROKER_CRED_ACTIVE_KID: 't2' };
    expect(await authenticateBroker(removed, req(c.token))).toBeNull();
    expect((await row(c.kid)).key_kid).toBe('t1'); // not re-wrapped
    const rep = await credentialKeyReport(removed);
    expect(rep.on_missing_kids).toBeGreaterThanOrEqual(1);
    // a row pointing at a kid that was never configured
    const c2 = await issueCredential(env, 'rot-b');
    await env.DB.prepare("UPDATE broker_credentials SET key_kid = 'zz9', secret_hmac = ?2 WHERE kid = ?1").bind(c2.kid, 'a'.repeat(64)).run();
    expect(await authenticateBroker(env, req(c2.token))).toBeNull();
    await expect(issueCredential({ ...env, BROKER_CRED_ACTIVE_KID: 'nope' }, 'rot-b')).rejects.toThrow(/ACTIVE_KID/);
  });
  it('0013 allows only revocation or a re-wrap to a different key kid', async () => {
    await addBroker('rot-c');
    const c = await issueCredential(env, 'rot-c');
    await expect(env.DB.prepare('UPDATE broker_credentials SET secret_hmac = ?2 WHERE kid = ?1').bind(c.kid, 'b'.repeat(64)).run()).rejects.toThrow(/only revocation or key re-wrap/);
    await expect(env.DB.prepare("UPDATE broker_credentials SET key_kid = 't2', expires_at = expires_at + 1 WHERE kid = ?1").bind(c.kid).run()).rejects.toThrow(/only revocation/);
    await expect(env.DB.prepare("UPDATE broker_credentials SET key_kid = 't2', revoked_at = 1 WHERE kid = ?1").bind(c.kid).run()).rejects.toThrow(/only revocation/);
    await revokeCredential(env, 'rot-c', c.kid);
    await expect(env.DB.prepare("UPDATE broker_credentials SET key_kid = 't2', secret_hmac = ?2 WHERE kid = ?1").bind(c.kid, 'c'.repeat(64)).run()).rejects.toThrow(/only revocation/);
  });
  it('admin key report requires API_TOKEN and returns counts only', async () => {
    expect((await call('/admin/broker-delivery/credential-keys', { token: 'nope' })).status).toBe(401);
    const r = await (await call('/admin/broker-delivery/credential-keys', { token: 'test-legacy-token' })).json();
    expect(r.active_kid).toBe('t1');
    expect(r.configured_kids).toEqual(['t1', 't2']);
    expect(JSON.stringify(r)).not.toMatch(/BwcH|CAgI/);
  });
});

describe('signup finish (list issued + 90 days)', () => {
  const T = 2_000_000_000; // fixed clock
  async function signup(id) {
    await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, pw_hash, created_at) VALUES ('fin-user', 'fin@fin.example', 'x', 1)").run();
    await env.DB.prepare("INSERT INTO optout_requests (id, user_id, status, created_at, updated_at, kind, service_id) VALUES (?1, 'fin-user', 'queued', ?2, ?2, 'tx', 'signup')").bind(id, T).run();
  }
  const fin = async (id) => (await env.DB.prepare('SELECT finished_at FROM optout_requests WHERE id = ?1').bind(id).first()).finished_at;
  it('not finished on no list, nor while any list window (+45 extension) is open; finished after; idempotent', async () => {
    await addBroker('fin-a'); await addBroker('fin-b');
    for (const id of ['fin-none', 'fin-one', 'fin-two']) await signup(id);
    await makeList('fin-a', { createdAt: T, records: [{ request_ref: 'fin-one', email: 'one@fin.example' }, { request_ref: 'fin-two', email: 'two@fin.example' }] });
    await makeList('fin-b', { createdAt: T + 30 * DAY, records: [{ request_ref: 'fin-two', email: 'two@fin.example' }] });
    await finishSignups(env, T + 45 * DAY);            // past the base window only
    await finishSignups(env, T + 90 * DAY - 1);
    expect(await fin('fin-one')).toBeNull();
    await finishSignups(env, T + 90 * DAY);
    expect(await fin('fin-one')).toBe(T + 90 * DAY);
    expect(await fin('fin-two')).toBeNull();           // fin-b list still open
    expect(await fin('fin-none')).toBeNull();
    await finishSignups(env, T + 120 * DAY);
    expect(await fin('fin-two')).toBe(T + 120 * DAY);  // latest list + 90 days
    const again = await finishSignups(env, T + 400 * DAY);
    expect(await fin('fin-one')).toBe(T + 90 * DAY);   // unchanged
    expect(again.finished).toBe(0);
    expect(await fin('fin-none')).toBeNull();
  });
  it('finished signups follow the 24-month clock; Texas broker requests stay 3 years', async () => {
    await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, pw_hash, created_at) VALUES ('fin-user', 'fin@fin.example', 'x', 1)").run();
    const now = Math.floor(Date.now() / 1000);
    const ins = (id, svc, f) => env.DB.prepare("INSERT INTO optout_requests (id, user_id, status, created_at, updated_at, kind, service_id, finished_at) VALUES (?1, 'fin-user', 'confirmed', 1, 1, 'tx', ?2, ?3)").bind(id, svc, f).run();
    await ins('ret-signup-old', 'signup', now - 740 * DAY);
    await ins('ret-signup-young', 'signup', now - 700 * DAY);
    await ins('ret-tx-800', 'tx-acme', now - 800 * DAY);
    await ins('ret-tx-1100', 'tx-beta', now - 1100 * DAY);
    await purge(env, now);
    const left = (await env.DB.prepare("SELECT id FROM optout_requests WHERE id LIKE 'ret-%' ORDER BY id").all()).results.map((r) => r.id);
    expect(left).toEqual(['ret-signup-young', 'ret-tx-800']);
  });
});

describe('review 5775555002 fixes', () => {
  const req = (t) => new Request('https://api.test/broker/v1/lists', { headers: { Authorization: `Bearer ${t}` } });
  it('REPLACE INTO / INSERT OR REPLACE cannot un-revoke or re-key a credential; revoked rows are never re-wrapped', async () => {
    await addBroker('rep-a');
    const c = await issueCredential(env, 'rep-a');
    await revokeCredential(env, 'rep-a', c.kid);
    const ins = (verb) => env.DB.prepare(`${verb} INTO broker_credentials (kid, broker_id, secret_hmac, key_kid, created_at, expires_at, revoked_at) VALUES (?1, 'rep-a', ?2, 't2', 1, 9999999999, NULL)`).bind(c.kid, 'd'.repeat(64)).run();
    await expect(ins('INSERT OR REPLACE')).rejects.toThrow(/kid exists/);
    await expect(ins('REPLACE')).rejects.toThrow(/kid exists/);
    await expect(ins('INSERT OR IGNORE')).rejects.toThrow(/kid exists/);
    const row = await env.DB.prepare('SELECT revoked_at, key_kid FROM broker_credentials WHERE kid = ?1').bind(c.kid).first();
    expect(row.revoked_at).not.toBeNull();
    expect(row.key_kid).toBe('t1');
    // a revoked credential under an old key: auth fails and nothing is re-wrapped, even directly
    const rotated = { ...env, BROKER_CRED_ACTIVE_KID: 't2' };
    expect(await authenticateBroker(rotated, req(c.token))).toBeNull();
    expect((await env.DB.prepare('SELECT key_kid FROM broker_credentials WHERE kid = ?1').bind(c.kid).first()).key_kid).toBe('t1');
    await expect(env.DB.prepare("UPDATE broker_credentials SET key_kid = 't2', secret_hmac = ?2 WHERE kid = ?1").bind(c.kid, 'e'.repeat(64)).run()).rejects.toThrow(/only revocation/);
    await expect(env.DB.prepare('UPDATE broker_credentials SET revoked_at = revoked_at + 1 WHERE kid = ?1').bind(c.kid).run()).rejects.toThrow(/only revocation/);
    // live credentials still re-wrap through the sanctioned UPDATE
    const live = await issueCredential(env, 'rep-a');
    expect(await authenticateBroker(rotated, req(live.token))).not.toBeNull();
    expect((await env.DB.prepare('SELECT key_kid FROM broker_credentials WHERE kid = ?1').bind(live.kid).first()).key_kid).toBe('t2');
  });
  it('a failure partway through saveList fails loudly, marks nothing as listed, and the next run lists those requests', async () => {
    await addBroker('pf-a', 'email');
    const recs = Array.from({ length: 40 }, (_, i) => ({ request_ref: `pf-${i}`, email: `p${i}@pf.example` }));
    const load = async (_e, b, t) => {
      const done = (await env.DB.prepare(
        "SELECT r.request_ref FROM broker_list_refs r JOIN broker_hash_audit a ON a.list_id = r.list_id AND a.event = 'list.generated' WHERE r.list_id LIKE 'pf-a-%'",
      ).all()).results.map((x) => x.request_ref);
      return b === 'pf-a' && t === 'email' ? recs.filter((r) => !done.includes(r.request_ref)) : [];
    };
    let n = 0;
    const flaky = { ...env, DB: new Proxy(env.DB, { get: (tgt, k) => (k === 'batch' ? (st) => (++n === 2 ? Promise.reject(new Error('boom')) : tgt.batch(st)) : (typeof tgt[k] === 'function' ? tgt[k].bind(tgt) : tgt[k])) }) };
    const at = Date.UTC(2027, 0, 1, 9) / 1000;
    // direct saveList with a small chunk: throws, writes list.save_failed with counts only
    const built = await buildList({ brokerId: 'pf-a', listType: 'email', version: 1, createdAt: at, idGen: ids, records: recs });
    await expect(saveList(flaky, built, { chunk: 20, at })).rejects.toThrow(/list save failed after 1 of/);
    const f = await env.DB.prepare("SELECT detail FROM broker_hash_audit WHERE event = 'list.save_failed' AND list_id = 'pf-a-email-v1'").first();
    expect(Object.keys(JSON.parse(f.detail)).sort()).toEqual(['chunks', 'chunks_written', 'rows', 'version']);
    expect(f.detail).not.toMatch(/@|pf-\d/);
    expect(await env.DB.prepare("SELECT 1 FROM broker_list_runs WHERE broker_id = 'pf-a'").first()).toBeNull();
    expect((await load(env, 'pf-a', 'email')).length).toBe(40); // nothing counts as listed
    // next run (healthy DB) lists all 40
    const r = await monthlyLists(env, at, { loadRecords: load });
    expect(r.built).toBe(1);
    expect((await load(env, 'pf-a', 'email')).length).toBe(0);
  });
  it('the cron job rejects (and logs) when a list save fails', async () => {
    await addBroker('pf-b', 'email');
    const broken = { ...env, DB: new Proxy(env.DB, { get: (tgt, k) => (k === 'batch' ? () => Promise.reject(new Error('x')) : (typeof tgt[k] === 'function' ? tgt[k].bind(tgt) : tgt[k])) }) };
    const at = Date.UTC(2027, 1, 1, 9) / 1000;
    await expect(monthlyLists(broken, at, { loadRecords: async (_e, b) => (b === 'pf-b' ? [{ request_ref: 'pfb-1', email: 'x@pfb.example' }] : []) }))
      .rejects.toThrow(/broker list build failed/);
  });
  it('broker-data aging starts at the 90-day close: an unanswered item survives until close + 24 months', async () => {
    const t = NOW();
    await addBroker('ag-a');
    const keep = await makeList('ag-a', { createdAt: t - (730 + 89) * DAY, version: 1 });  // closed 729 days ago
    const drop = await makeList('ag-a', { createdAt: t - (730 + 91) * DAY, version: 2 });  // closed 731 days ago
    await brokerPurge(env, t);
    const left = (await env.DB.prepare("SELECT list_id FROM broker_lists WHERE broker_id = 'ag-a' ORDER BY list_id").all()).results.map((x) => x.list_id);
    expect(left).toEqual([keep.manifest.list_id]);
    expect(drop.manifest.list_id).toBe('ag-a-email-v2');
    // and the trigger enforces it even with an open gate
    await expect(env.DB.batch([
      env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('broker_purge', ?1)").bind(t - 731 * DAY),
      env.DB.prepare('DELETE FROM broker_list_items WHERE list_id = ?1').bind(keep.manifest.list_id),
    ])).rejects.toThrow(/write-once/);
  });
  it('status upload has a streaming 5 MB cap; BROKER_ADMIN_TOKEN replaces API_TOKEN once set', async () => {
    await addBroker('cap-a');
    const a = await issueCredential(env, 'cap-a');
    await makeList('cap-a');
    const big = new ReadableStream({ start(c) { const k = new Uint8Array(1024 * 1024).fill(65); for (let i = 0; i < 6; i++) c.enqueue(k); c.close(); } });
    const r = await worker.fetch(new Request('https://api.test/broker/v1/lists/cap-a-email-v1/status?version=1', { method: 'POST', body: big, duplex: 'half', headers: { Authorization: `Bearer ${a.token}` } }), env);
    expect(r.status).toBe(413);
    const sep = { ...env, BROKER_ADMIN_TOKEN: 'separate-admin-token-for-tests' };
    const get = (tok) => worker.fetch(new Request('https://api.test/admin/broker-delivery/credential-keys', { headers: { Authorization: `Bearer ${tok}` } }), sep);
    expect((await get('test-legacy-token')).status).toBe(401);
    expect((await get('separate-admin-token-for-tests')).status).toBe(200);
  });
});

describe('review notes follow-up', () => {
  const issueWith = (e, id) => worker.fetch(new Request(`https://api.test/admin/broker-delivery/brokers/${id}/credentials`, {
    method: 'POST', headers: { Authorization: 'Bearer test-legacy-token' } }), e);
  it('credential issuance returns 503 broker_cred_misconfigured for missing/bad key config, logged without key material', async () => {
    await addBroker('cfg-a');
    const keys = JSON.parse(env.BROKER_CRED_KEYS);
    const variants = [
      { BROKER_CRED_KEYS: undefined },
      { BROKER_CRED_KEYS: 'not json' },
      { BROKER_CRED_KEYS: JSON.stringify({ t1: 'c2hvcnQ=' }) },          // key too short
      { BROKER_CRED_KEYS: JSON.stringify({ 'Bad Kid': keys.t1 }) },      // invalid kid
      { BROKER_CRED_ACTIVE_KID: 'zz' },                                  // active kid not in map
      { BROKER_CRED_ACTIVE_KID: undefined },
    ];
    const lines = [];
    const orig = console.log;
    console.log = (...a) => { lines.push(a.join(' ')); };
    try {
      for (const v of variants) {
        const r = await issueWith({ ...env, ...v }, 'cfg-a');
        expect(r.status, JSON.stringify(Object.keys(v))).toBe(503);
        expect(await r.json()).toEqual({ error: 'broker_cred_misconfigured' });
      }
    } finally { console.log = orig; }
    const cfg = lines.filter((l) => l.includes('broker_cred_config'));
    expect(cfg).toHaveLength(variants.length);
    for (const l of cfg) {
      expect(JSON.parse(l).kind).toMatch(/^(no_valid_keys|active_kid_missing)$/);
      expect(l).not.toMatch(/BwcH|CAgI|c2hvcnQ|Bad Kid/);
    }
    expect((await issueWith(env, 'cfg-a')).status).toBe(201);            // healthy config still works
    expect((await issueWith({ ...env, BROKER_CRED_ACTIVE_KID: 'zz' }, 'nobody')).status).toBe(404); // unknown broker stays 404
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM broker_credentials WHERE broker_id = 'cfg-a'").first()).n).toBe(1);
  });

  it('a finished signup put on a new list is unfinished again and finishes 90 days after the new list', async () => {
    const T = 2_100_000_000;
    await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, pw_hash, created_at) VALUES ('rl-user', 'rl@rl.example', 'x', 1)").run();
    await env.DB.prepare("INSERT INTO optout_requests (id, user_id, status, created_at, updated_at, kind, service_id) VALUES ('rl-1', 'rl-user', 'queued', ?1, ?1, 'tx', 'signup')").bind(T).run();
    await addBroker('rl-a', 'email'); await addBroker('rl-b', 'email');
    const rec = [{ request_ref: 'rl-1', email: 'one@rl.example' }];
    const only = (bid) => async (_e, b) => (b === bid ? rec : []);
    await env.DB.prepare("UPDATE delivery_brokers SET enabled = 0 WHERE broker_id NOT IN ('rl-a')").run();
    try {
      await monthlyLists(env, T, { loadRecords: only('rl-a') });
      await finishSignups(env, T + 90 * DAY);
      const fin = async () => (await env.DB.prepare("SELECT finished_at FROM optout_requests WHERE id = 'rl-1'").first()).finished_at;
      expect(await fin()).toBe(T + 90 * DAY);
      // re-listed to a new broker 100 days in
      await env.DB.prepare("UPDATE delivery_brokers SET enabled = 1 WHERE broker_id = 'rl-b'").run();
      const T2 = T + 100 * DAY;
      await monthlyLists(env, T2, { loadRecords: only('rl-b') });
      expect(await fin()).toBeNull();
      await finishSignups(env, T2 + 90 * DAY - 1);
      expect(await fin()).toBeNull();
      await finishSignups(env, T2 + 90 * DAY);
      expect(await fin()).toBe(T2 + 90 * DAY);
      // a signup purged before a re-list never comes back
      await env.DB.prepare("INSERT INTO optout_requests (id, user_id, status, created_at, updated_at, kind, service_id, finished_at) VALUES ('rl-gone', 'rl-user', 'queued', 1, 1, 'tx', 'signup', 1)").run();
      await purge(env, NOW());
      expect(await env.DB.prepare("SELECT 1 FROM optout_requests WHERE id = 'rl-gone'").first()).toBeNull();
      const T3 = T + 200 * DAY;
      await monthlyLists(env, T3, { loadRecords: async (_e, b) => (b === 'rl-a' ? [{ request_ref: 'rl-gone', email: 'gone@rl.example' }] : []) });
      expect(await env.DB.prepare("SELECT 1 FROM optout_requests WHERE id = 'rl-gone'").first()).toBeNull();
    } finally {
      await env.DB.prepare("UPDATE delivery_brokers SET enabled = 1").run();
    }
  });
});
