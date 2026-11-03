#!/usr/bin/env node
// KV (RECORDS) -> D1 (DB) migration. READ-ONLY on KV: only list + get; never put/delete.
// Writes to D1 use the D1 HTTP query API with bound params (no SQL string building).
//
// Env: CLOUDFLARE_API_TOKEN (never printed), CF_ACCOUNT_ID, KV_NAMESPACE_ID, D1_DATABASE_ID (import only).
//   node scripts/migrate-kv-to-d1.mjs --dry-run                 # read KV, write backup, print counts/mapping
//   node scripts/migrate-kv-to-d1.mjs --from-backup FILE --dry-run
//   node scripts/migrate-kv-to-d1.mjs --import --batch 1 --batch-size 25 --user-id <uuid> [--from-backup FILE]
// Import is idempotent (INSERT OR IGNORE on unique legacy_key) and does exactly ONE batch per run.
// settings:* keys (profile PII) are NOT imported here: re-save the profile through PUT /profile so it is encrypted.
import fs from 'node:fs';
import path from 'node:path';
import { mapEntry, ROW_COLS } from './kv-mapping.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const { CLOUDFLARE_API_TOKEN: TOKEN, CF_ACCOUNT_ID: ACCT, KV_NAMESPACE_ID: NS, D1_DATABASE_ID: DBID } = process.env;
const API = 'https://api.cloudflare.com/client/v4';
const BACKUP_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.migration-backup');
const PREFIXES = ['record:', 'txreq:', 'settings:'];

async function cf(url, init = {}) {
  const res = await fetch(API + url, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Cloudflare API ${res.status} on ${url.replace(/\/values\/.*/, '/values/<key>')}`);
  return res;
}

async function readKv() {
  if (!TOKEN || !ACCT || !NS) throw new Error('set CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, KV_NAMESPACE_ID');
  const out = {};
  for (const prefix of PREFIXES) {
    let cursor = '';
    do {
      const q = new URLSearchParams({ prefix, limit: '1000', ...(cursor ? { cursor } : {}) });
      const j = await (await cf(`/accounts/${ACCT}/storage/kv/namespaces/${NS}/keys?${q}`)).json();
      for (const k of j.result) {
        const txt = await (await cf(`/accounts/${ACCT}/storage/kv/namespaces/${NS}/values/${encodeURIComponent(k.name)}`)).text();
        try { out[k.name] = JSON.parse(txt); } catch { out[k.name] = { __unparseable: true }; }
      }
      cursor = j.result_info?.cursor || '';
    } while (cursor);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const file = path.join(BACKUP_DIR, `kv-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log(`backup written (contains PII, mode 600): ${path.relative(process.cwd(), file)}`);
  return out;
}

async function d1(sql, params) {
  const r = await cf(`/accounts/${ACCT}/d1/database/${DBID}/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('D1 query failed');
  return j.result[0];
}

const data = opt('--from-backup') ? JSON.parse(fs.readFileSync(opt('--from-backup'), 'utf8')) : await readKv();
const keys = Object.keys(data).sort();
const userId = opt('--user-id', '00000000-0000-0000-0000-000000000000');
const mapped = [];
const summary = { total_keys: keys.length, by_prefix: {}, status_mapping: {}, confirmations: 0, warnings: [], unmapped_fields: {}, skipped: [] };
for (const k of keys) {
  const p = k.split(':')[0];
  summary.by_prefix[p] = (summary.by_prefix[p] || 0) + 1;
  const m = mapEntry(k, data[k], userId);
  if (m.skip) { summary.skipped.push(`${p}:* (${m.skip})`); continue; }
  mapped.push(m);
  const sk = `${m.row.kind}:${data[k]?.status}->${m.row.status}`;
  summary.status_mapping[sk] = (summary.status_mapping[sk] || 0) + 1;
  if (m.confirmation) summary.confirmations++;
  for (const w of m.warnings) summary.warnings.push(`${k}: ${w}`);
  for (const f of m.unmappedFields) summary.unmapped_fields[`${p}.${f}`] = (summary.unmapped_fields[`${p}.${f}`] || 0) + 1;
}
summary.skipped = [...new Set(summary.skipped)];
summary.importable = mapped.length;
console.log(JSON.stringify(summary, null, 2)); // field NAMES and counts only, never values

if (flag('--import')) {
  if (!DBID || !opt('--user-id')) throw new Error('--import needs D1_DATABASE_ID and --user-id');
  const size = Math.min(25, Number(opt('--batch-size', 25)));
  const batch = Number(opt('--batch', 1));
  const slice = mapped.slice((batch - 1) * size, batch * size);
  const ph = ROW_COLS.map((_, i) => `?${i + 1}`).join(', ');
  const insertRow = `INSERT OR IGNORE INTO optout_requests (${ROW_COLS.join(', ')}) VALUES (${ph})`; // fixed column list, values bound
  let inserted = 0; let conf = 0;
  for (const m of slice) {
    const r = await d1(insertRow, ROW_COLS.map((c) => m.row[c]));
    if (r.meta.changes === 1) {
      inserted++;
      if (m.confirmation) {
        await d1('INSERT INTO confirmations (request_id, confirmation_no, channel, received_at) VALUES (?1, ?2, ?3, ?4)',
          [m.confirmation.request_id, m.confirmation.confirmation_no, m.confirmation.channel, m.confirmation.received_at]);
        conf++;
      }
    }
  }
  const legacyKeys = slice.map((m) => m.row.legacy_key);
  console.log(JSON.stringify({ batch, batch_size: slice.length, inserted, skipped_existing: slice.length - inserted, confirmations_inserted: conf,
    remaining_batches: Math.max(0, Math.ceil(mapped.length / size) - batch), legacy_keys: legacyKeys }, null, 2));
}
