import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';
import { buildList, saveList, ingestStatus, sha256HexOf } from '../src/hashEngine.js';
import { issueCredential, revokeCredential, authenticateBroker, monthlyLists, brokerPurge, periodOf, loadSignupRecords } from '../src/brokerDelivery.js';
import { encryptPii } from '../src/crypto.js';

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
    expect(batches).toBe(Math.ceil((1 + 130 * 2 + 1) / 50));
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
    await env.DB.prepare("INSERT INTO users (id, email, pw_hash, created_at) VALUES ('ld-user', 'ld-owner@ld.example', 'x', ?1)").bind(t).run().catch(() => {});
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
    const old = await makeList('pg-a', { createdAt: t - 800 * DAY, version: 1 });
    const mixed = await makeList('pg-a', { createdAt: t - 780 * DAY, version: 2, records: [{ request_ref: 'pg-m1', email: 'm1@pg.example' }, { request_ref: 'pg-m2', email: 'm2@pg.example' }] });
    const young = await makeList('pg-a', { createdAt: t - 10 * DAY, version: 3 });
    const ins = (l, item, at) => env.DB.prepare('INSERT INTO broker_status (list_id, item_id, status, received_at) VALUES (?1, ?2, 3, ?3)').bind(l, item, at).run();
    await ins(old.manifest.list_id, old.items[0].item_id, t - 790 * DAY);       // old status -> purged
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
