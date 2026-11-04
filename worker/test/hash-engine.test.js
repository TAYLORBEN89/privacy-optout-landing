import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import vectorsCsv from '../../docs/samples/synthetic-test-vectors.csv?raw';
import statusTemplate from '../../docs/samples/status-response-template.csv?raw';
import { stdName, stdEmail, stdPhone, stdZip, stdDob, hashValue, compositeHash, hashFor, buildList, saveList, ingestStatus, RESPONSE_WINDOW_DAYS } from '../src/hashEngine.js';

// Expected hashes computed independently: printf %s 'x' | openssl dgst -sha256 -binary | base64
const H = {
  juanpablo: '91hIbrbzNeqHs3o81O5yNrXUj7wDd2shvZ6THKi9qz8=', // also the published CPPA DROP spec vector
  martinez: '2wRPGbwBNxhShjRczx8GfS2c4cjvs4NJskeWloUNtp8=',   // also the published CPPA DROP spec vector
  bjornoconnorlopez: 'dt5BQU1bH4kY3rMhzEQ9PbdaB4a1m8hrrCOP9jj3PzY=',
  dob: 'Qzs+CDJkSiNw2NDie4BNMNUh2SApKDrYqNUF2vQiYHc=',
  zip95811: 'hhrJ0lmzrCGQGqGD36pCucffqrftb5k70CV4OogYNKM=',
  phone: 'Kqb5sWi/zGQOa1P0G8oKcQ4lrzPEwui2TgQ/I6G8h3s=',
  email: '7unXmzUnRdnshdyh+VVjfB/qr7kWSxUmH/beD4FXAJA=',
  ndzJaneDoe: 'ZAVB12m/ySO0zl9zSI8xgd6RFJFBVpHSOkQhMeMfRrY=',
};
const STD = { first_name: stdName, last_name: stdName, dob: stdDob, zip: stdZip, phone: stdPhone, email: stdEmail };

function parseCsv(text) {
  return text.split('\n').filter((l) => l && !l.startsWith('#')).slice(1).map((l) => {
    const g = l.match(/^([a-z_]+),"(.*)",([^,]+),([^,]+)$/);
    return { field: g[1], raw: g[2], std: g[3], hash: g[4] };
  });
}

describe('standardization', () => {
  it('names: lowercase, accents folded, punctuation/spaces removed (spec example)', () => {
    expect(stdName('Björn O\'Connor-López')).toBe('bjornoconnorlopez');
    expect(stdName('Juan Pablo')).toBe('juanpablo');
    expect(stdName('Strauß')).toBe('strauss');
    expect(stdName('Æsir Œuvre Øre Łukasz')).toBe('aesiroeuvreorelukasz');
    expect(stdName('  ZOË. ')).toBe('zoe');
    expect(stdName('李')).toBe('李');
    expect(stdName(' -- ')).toBeNull();
  });
  it('DOB formats -> YYYYMMDD, invalid dates rejected', () => {
    for (const v of ['1990-01-12', '1990/1/12', '19900112', '01/12/1990', '1-12-1990']) expect(stdDob(v)).toBe('19900112');
    expect(stdDob('1990-02-30')).toBeNull();
    expect(stdDob('12-01')).toBeNull();
  });
  it('ZIP and ZIP+4 -> 5 digits', () => {
    expect(stdZip('95811-6213')).toBe('95811');
    expect(stdZip(' 958116213 ')).toBe('95811');
    expect(stdZip('9581')).toBeNull();
  });
  it('phone -> last 10 digits', () => {
    for (const v of ['+1(987) 765-4321', '987.765.4321', '19877654321', '+1 987 765 4321']) expect(stdPhone(v)).toBe('9877654321');
    expect(stdPhone('765-4321')).toBeNull();
  });
  it('email trimmed and lowercased, special characters kept', () => {
    expect(stdEmail('  Jane.Doe+TX@Example.COM ')).toBe('jane.doe+tx@example.com');
    expect(stdEmail('not-an-email')).toBeNull();
  });
});

describe('hashing', () => {
  it('SHA-256/UTF-8/Base64, 44 chars, matches openssl vectors', async () => {
    expect(await hashValue('juanpablo')).toBe(H.juanpablo);
    expect(await hashValue('martinez')).toBe(H.martinez);
    expect(await hashValue(stdName('Björn O\'Connor-López'))).toBe(H.bjornoconnorlopez);
    expect(await hashValue(stdDob('01/12/1990'))).toBe(H.dob);
    expect(await hashValue(stdZip('95811-6213'))).toBe(H.zip95811);
    expect(await hashFor('phone', { phone: '+1 (987) 765-4321' })).toBe(H.phone);
    expect(await hashFor('email', { email: ' Jane.Doe+TX@example.com' })).toBe(H.email);
    expect(H.email).toHaveLength(44);
  });
  it('NDZ composite = hash(first+last+dob+zip hashes), order matters', async () => {
    const rec = { first_name: 'Jane', last_name: 'Doe', dob: '1990-01-12', zip: '78701-1234' };
    expect(await hashFor('ndz', rec)).toBe(H.ndzJaneDoe);
    const swapped = await compositeHash(await Promise.all(['doe', 'jane', '19900112', '78701'].map(hashValue)));
    expect(swapped).not.toBe(H.ndzJaneDoe);
    expect(await hashFor('ndz', { ...rec, zip: '' })).toBeNull();
  });
  it('reproduces every row of docs/samples/synthetic-test-vectors.csv', async () => {
    const rows = parseCsv(vectorsCsv);
    expect(rows.length).toBeGreaterThanOrEqual(15);
    for (const r of rows) {
      if (r.field === 'ndz') {
        const [first_name, last_name, dob, zip] = r.raw.split('|');
        expect(await hashFor('ndz', { first_name, last_name, dob, zip })).toBe(r.hash);
        continue;
      }
      expect(STD[r.field](r.raw), `${r.field} ${r.raw}`).toBe(r.std);
      expect(await hashValue(r.std)).toBe(r.hash);
    }
  });
});

const T0 = 1_800_000_000;
const DAY = 86400;
let n = 0;
const ids = (...list) => () => list[n++ % list.length];
const recs = [
  { request_ref: 'req_b', email: 'b@example.com' },
  { request_ref: 'req_a', email: 'A@example.com ' },
  { request_ref: 'req_dup', email: 'a@example.com' }, // same consumer hash -> skipped
  { request_ref: 'req_none' },                         // no email -> skipped
];

describe('list files', () => {
  it('versioned, 45-day due date, sorted ids, hashes only, no raw PII', async () => {
    n = 0;
    const out = await buildList({ brokerId: 'acme-data', listType: 'email', version: 1, createdAt: T0, records: recs, idGen: ids('ZZZ1', 'AAA1') });
    expect(out.manifest).toMatchObject({ list_id: 'acme-data-email-v1', version: 1, row_count: 2, response_due: T0 + RESPONSE_WINDOW_DAYS * DAY });
    expect(out.manifest.file_name).toMatch(/^droptx_acme-data-email-v1_\d{8}\.csv$/);
    expect(out.skipped).toBe(2);
    const lines = out.csv.trim().split('\n');
    expect(lines[0]).toBe('Id,Hash');
    expect(lines[1].startsWith('AAA1,')).toBe(true);
    expect(lines[2].startsWith('ZZZ1,')).toBe(true);
    expect(out.csv).not.toMatch(/@|example|req_/);
    expect(out.manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('rejects bad broker ids, list types and versions', async () => {
    await expect(buildList({ brokerId: 'Bad Id', listType: 'email', version: 1, createdAt: T0, records: [] })).rejects.toThrow();
    await expect(buildList({ brokerId: 'acme', listType: 'ssn', version: 1, createdAt: T0, records: [] })).rejects.toThrow();
    await expect(buildList({ brokerId: 'acme', listType: 'email', version: 0, createdAt: T0, records: [] })).rejects.toThrow();
  });
});

async function seed(broker, version = 1) {
  n = 0;
  const out = await buildList({ brokerId: broker, listType: 'email', version, createdAt: T0, records: recs, idGen: ids(`${broker}X1`, `${broker}X2`) });
  await saveList(env, out);
  return out.manifest.list_id;
}

describe('status ingest + audit', () => {
  it('accepts valid codes, rejects unknown code / id / duplicates, writes once, audits counts only', async () => {
    const listId = await seed('brk1');
    const csv = 'Id,Status\nbrk1X1,3\nbrk1X2,9\nnope,5\nbrk1X1,4\n';
    const r = await ingestStatus(env, { brokerId: 'brk1', listId, version: 1, csv, now: T0 + DAY });
    expect(r.ok).toBe(true);
    expect(r.accepted).toBe(1);
    expect(r.rejected.map((x) => x.reason)).toEqual(['unknown_code', 'unknown_id', 'duplicate_in_file']);
    const again = await ingestStatus(env, { brokerId: 'brk1', listId, version: 1, csv: 'Id,Status\nbrk1X1,2\nbrk1X2,5\n', now: T0 + 2 * DAY });
    expect(again.rejected.map((x) => x.reason)).toEqual(['already_recorded']);
    expect(again.accepted).toBe(1);
    expect(again.outstanding).toBe(0);
    await expect(env.DB.prepare('UPDATE broker_status SET status = 2').run()).rejects.toThrow(/write-once/);
    const audit = (await env.DB.prepare('SELECT event, detail FROM broker_hash_audit WHERE list_id = ?1 ORDER BY id').bind(listId).all()).results;
    expect(audit.map((a) => a.event)).toEqual(['list.generated', 'status.ingested', 'status.ingested']);
    expect(JSON.stringify(audit)).not.toMatch(/@|req_|=/);
  });
  it('rejects whole file: unknown list, version or broker mismatch, late, bad header', async () => {
    const listId = await seed('brk2');
    const base = { brokerId: 'brk2', listId, version: 1, csv: 'Id,Status\nbrk2X1,3\n', now: T0 + DAY };
    expect((await ingestStatus(env, { ...base, listId: 'brk2-email-v9' })).reason).toBe('unknown_list');
    expect((await ingestStatus(env, { ...base, version: 2 })).reason).toBe('version_mismatch');
    expect((await ingestStatus(env, { ...base, brokerId: 'other' })).reason).toBe('broker_mismatch');
    expect((await ingestStatus(env, { ...base, now: T0 + 45 * DAY + 1 })).reason).toBe('late');
    expect((await ingestStatus(env, { ...base, csv: 'id;status\n' })).reason).toBe('bad_header');
    expect((await ingestStatus(env, { ...base, now: T0 + 45 * DAY })).accepted).toBe(1); // due date itself is on time
  });
  it('duplicate list version is refused', async () => {
    await seed('brk3');
    await expect(seed('brk3')).rejects.toThrow();
  });
  it('audit log is append-only', async () => {
    await seed('brk4');
    await expect(env.DB.prepare('UPDATE broker_hash_audit SET event = ?1').bind('x').run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare('DELETE FROM broker_hash_audit').run()).rejects.toThrow(/append-only/);
  });
  it('status template has the right header and only valid codes', () => {
    const [head, ...rows] = statusTemplate.trim().split('\n');
    expect(head).toBe('Id,Status');
    for (const r of rows) expect(['2', '3', '4', '5']).toContain(r.split(',')[1]);
  });
});
