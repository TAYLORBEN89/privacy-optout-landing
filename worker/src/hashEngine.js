// Broker hash engine, modeled on California DROP (11 CCR §7613 and the CPPA DROP technical spec v1.2.0).
// Raw PII is only ever held in memory here: callers decrypt (existing PII_ENC_KEY / SIGNUP_PII_KEY paths,
// unchanged), standardize + hash, and only hashes and opaque ids leave this module.

const DAY = 86400;
export const RESPONSE_WINDOW_DAYS = 45;
export const STATUS = { 2: 'exempt', 3: 'deleted', 4: 'opted_out', 5: 'not_found' };
export const LIST_TYPES = ['email', 'phone', 'ndz'];

// DROP Transliteration Mapping, copied verbatim from the CPPA DROP technical spec v1.2.0 (last updated July 2026),
// "Working with the data" > Name standardization > DROP Transliteration Mapping:
// https://privacy.ca.gov/drop-for-data-brokers/technical-specifications/working-with-data/ (fetched 2026-11-04).
// Letters not in the table (e.g. Serbian/Macedonian ђ ј љ њ ћ џ ѕ ѓ ќ) are left unchanged, as the spec gives no mapping.
const GREEK = {
  'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'i', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm',
  'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps',
  'ω': 'o', 'ά': 'a', 'έ': 'e', 'ί': 'i', 'ή': 'i', 'ύ': 'y', 'ό': 'o', 'ώ': 'o', 'ϊ': 'i', 'ΐ': 'i', 'ϋ': 'y', 'ΰ': 'y',
};
const CYRILLIC = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
  'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'є': 'e', 'і': 'i', 'ї': 'i',
  'ґ': 'g', 'ў': 'u',
};
const SPECIAL_LATIN = {
  'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ð': 'd', 'þ': 'th', 'ł': 'l', 'đ': 'd', 'ħ': 'h', 'ŋ': 'n', 'ı': 'i', 'ĳ': 'ij', 'ŀ': 'l',
};
export const TRANSLIT = { ...GREEK, ...CYRILLIC, ...SPECIAL_LATIN };
const translit = (s) => Array.from(s, (c) => (c in TRANSLIT ? TRANSLIT[c] : c)).join('');

// Names (first and last are separate fields): lowercase, apply the DROP mapping (precomposed Greek accents included),
// fold remaining accents (NFD, drop combining marks), map again for any base letter exposed by NFD, then drop every
// non-letter/non-digit (spaces, hyphens, apostrophes, punctuation, symbols). CJK, Arabic and Hebrew stay unchanged.
export function stdName(v) {
  if (v == null) return null;
  let s = translit(String(v).toLowerCase());
  s = translit(s.normalize('NFD').replace(/\p{M}/gu, '')).replace(/[^\p{L}\p{N}]/gu, '');
  return s || null;
}

// Email: trimmed and lowercased; special characters are kept (§7613(a)(1)(A)(ii)(2)).
export function stdEmail(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(s) ? s : null;
}

// Phone (DROP spec v1.2.0): strip all non-numeric characters, keep the last 10 digits, or all digits if fewer
// than 10. No digits at all -> null (not hashable).
export function stdPhone(v) {
  if (v == null) return null;
  const d = String(v).replace(/\D/g, '');
  return d ? d.slice(-10) : null;
}

// ZIP (DROP spec v1.2.0): for ZIP+4 drop the +4 (everything from the first hyphen), keep letters and digits only,
// lowercase, remove leading zeros, then take the first five characters present.
// e.g. 91790-3771 -> 91790, M1B 1A1 -> m1b1a, 00712345 -> 71234, 00300-9999 -> 300.
// Our rule where the spec is silent: an empty value, or one that is only zeros/symbols, -> null (not hashable).
export function stdZip(v) {
  if (v == null) return null;
  const s = String(v).split('-')[0].replace(/[^\p{L}\p{N}]/gu, '').toLowerCase().replace(/^0+/, '').slice(0, 5);
  return s || null;
}

// DOB -> YYYYMMDD. Accepts YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD and US MM/DD/YYYY (or M-D-YYYY). Validates the date.
export function stdDob(v) {
  if (v == null) return null;
  const s = String(v).trim();
  let y, m, d, g;
  if ((g = s.match(/^(\d{4})[-/.]?(\d{1,2})[-/.]?(\d{1,2})$/)) && (s.length === 8 || /[-/.]/.test(s))) [, y, m, d] = g;
  else if ((g = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [, m, d, y] = g;
  else return null;
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return null;
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const enc = new TextEncoder();

// SHA-256 over UTF-8, Base64 (44 chars).
export async function hashValue(s) {
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

// Composite: concatenate per-field Base64 hashes (no separators), then SHA-256/Base64 again.
export async function compositeHash(fieldHashes) {
  return hashValue(fieldHashes.join(''));
}

// Hash a consumer record (decrypted, in memory) for one list type. Returns null when a field is missing.
export async function hashFor(listType, rec) {
  if (listType === 'email') { const e = stdEmail(rec.email); return e && hashValue(e); }
  if (listType === 'phone') { const p = stdPhone(rec.phone); return p && hashValue(p); }
  if (listType === 'ndz') {
    // Order fixed by the spec: FirstName + LastName + DOB + ZIP.
    const parts = [stdName(rec.first_name), stdName(rec.last_name), stdDob(rec.dob), stdZip(rec.zip)];
    if (parts.some((p) => !p)) return null;
    return compositeHash(await Promise.all(parts.map(hashValue)));
  }
  throw new Error('unknown list type');
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomId = () => { const b = crypto.getRandomValues(new Uint8Array(9)); return b64(b).replace(/\+/g, 'A').replace(/\//g, 'B'); };
const BROKER_ID = /^[a-z0-9][a-z0-9_-]{1,39}$/;

export const listIdOf = (brokerId, listType, version) => `${brokerId}-${listType}-v${version}`;
export const fileNameOf = (listId, createdAt) =>
  `droptx_${listId}_${new Date(createdAt * 1000).toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

// Build one versioned per-broker list. `records` are { request_ref, ...decrypted fields } held in memory only.
// Output CSV has Id,Hash only. Rows are sorted by Id (deterministic for a given set of ids).
// Duplicate hashes (two requests that standardize to the same identifier): one row and one Id in the file; every
// request ref is kept in item.refs (stored in broker_list_refs), so the broker's status for that Id applies to all.
export async function buildList({ brokerId, listType, version, createdAt, records, idGen = randomId }) {
  if (!BROKER_ID.test(brokerId || '')) throw new Error('invalid broker id');
  if (!LIST_TYPES.includes(listType)) throw new Error('unknown list type');
  if (!Number.isInteger(version) || version < 1) throw new Error('invalid version');
  const byHash = new Map();
  let skipped = 0;
  let merged = 0;
  for (const r of records) {
    const hash = await hashFor(listType, r);
    if (!hash) { skipped++; continue; } // a required field is missing or not standardizable
    const ref = String(r.request_ref);
    const hit = byHash.get(hash);
    if (hit) { if (!hit.refs.includes(ref)) { hit.refs.push(ref); merged++; } continue; }
    byHash.set(hash, { item_id: idGen(), request_ref: ref, refs: [ref], hash });
  }
  const items = [...byHash.values()];
  for (const i of items) { i.refs.sort(); i.request_ref = i.refs[0]; }
  items.sort((a, b) => (a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : 0));
  const csv = csvOf(items);
  const listId = listIdOf(brokerId, listType, version);
  const manifest = {
    list_id: listId, broker_id: brokerId, list_type: listType, version,
    created_at: createdAt, response_due: createdAt + RESPONSE_WINDOW_DAYS * DAY,
    row_count: items.length, file_name: fileNameOf(listId, createdAt),
    sha256: await sha256HexOf(csv),
    hash: 'SHA-256/UTF-8/Base64', status_codes: STATUS,
  };
  return { csv, manifest, items, skipped, merged };
}

// The exact file bytes: header, then one `Id,Hash` row per item sorted by Id, LF line endings.
export const csvOf = (items) => 'Id,Hash\n' + items.map((i) => `${i.item_id},${i.hash}`).join('\n') + (items.length ? '\n' : '');
export const sha256HexOf = async (text) => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));

async function audit(env, at, event, brokerId, listId, detail) {
  await env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(at, event, brokerId, listId, JSON.stringify(detail)).run();
}

// D1 batches are sent in chunks of BATCH_CHUNK statements to stay well under per-batch limits.
export const BATCH_CHUNK = 50;
export async function batchChunked(env, stmts, size = BATCH_CHUNK) {
  for (let i = 0; i < stmts.length; i += size) await env.DB.batch(stmts.slice(i, i + size));
}

// Persist a built list (prepared statements). Chunked: chunk 1 starts with the broker_lists row (plus the optional
// `head` statements, e.g. the monthly run ledger row), then items and refs, and the `list.generated` audit row goes
// in the LAST chunk. A list is only "complete" (downloadable) once that audit row exists and the stored item count
// equals row_count, so a crash between chunks never serves a partial file.
export async function saveList(env, { manifest, items, skipped, merged = 0 }, { head = [], chunk = BATCH_CHUNK } = {}) {
  const m = manifest;
  const stmts = [env.DB.prepare('INSERT INTO broker_lists (list_id, broker_id, list_type, version, created_at, response_due, row_count, sha256) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
    .bind(m.list_id, m.broker_id, m.list_type, m.version, m.created_at, m.response_due, m.row_count, m.sha256), ...head];
  for (const i of items) {
    stmts.push(env.DB.prepare('INSERT INTO broker_list_items (list_id, item_id, request_ref, hash) VALUES (?1, ?2, ?3, ?4)').bind(m.list_id, i.item_id, i.request_ref, i.hash));
    for (const ref of i.refs || [i.request_ref]) {
      stmts.push(env.DB.prepare('INSERT INTO broker_list_refs (list_id, item_id, request_ref) VALUES (?1, ?2, ?3)').bind(m.list_id, i.item_id, ref));
    }
  }
  stmts.push(env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(m.created_at, 'list.generated', m.broker_id, m.list_id, JSON.stringify({ version: m.version, rows: m.row_count, skipped, merged, sha256: m.sha256 })));
  await batchChunked(env, stmts, chunk);
}

// Ingest a broker status file (CSV "Id,Status"). Rules:
// - file rejected whole if: unknown list, version mismatch, broker mismatch, bad header, or received after response_due;
// - row rejected if: malformed, code not in {2,3,4,5}, Id not in this list, Id repeated in the file, or status already recorded.
// Accepted rows are written once (write-once table). Every call is audited with counts only.
// The broker is ALWAYS the authenticated credential's broker (credential.broker_id from authenticateBroker); nothing
// in the file or request body can name a broker.
export async function ingestStatus(env, { credential, listId, version, csv, now }) {
  if (!credential || typeof credential.broker_id !== 'string' || !credential.kid) throw new Error('authenticated credential required');
  const brokerId = credential.broker_id;
  const list = await env.DB.prepare('SELECT list_id, broker_id, version, response_due FROM broker_lists WHERE list_id = ?1').bind(listId).first();
  const fail = async (reason) => { await audit(env, now, 'status.rejected', brokerId, listId, { reason }); return { ok: false, reason, accepted: 0, rejected: [] }; };
  if (!list) return fail('unknown_list');
  if (list.broker_id !== brokerId) return fail('broker_mismatch');
  if (list.version !== version) return fail('version_mismatch');
  if (now > list.response_due) return fail('late');
  const lines = String(csv).replace(/\r/g, '').split('\n').filter((l) => l.length);
  if (lines[0] !== 'Id,Status') return fail('bad_header');

  const known = new Set((await env.DB.prepare('SELECT item_id FROM broker_list_items WHERE list_id = ?1').bind(listId).all()).results.map((r) => r.item_id));
  const done = new Set((await env.DB.prepare('SELECT item_id FROM broker_status WHERE list_id = ?1').bind(listId).all()).results.map((r) => r.item_id));
  const inFile = new Set();
  const rejected = [];
  const ok = [];
  lines.slice(1).forEach((l, i) => {
    const line = i + 2;
    const g = l.match(/^([A-Za-z0-9_-]{1,64}),(\d+)$/);
    if (!g) return rejected.push({ line, reason: 'malformed' });
    const [, id, codeStr] = g;
    const code = Number(codeStr);
    if (!STATUS[code]) return rejected.push({ line, reason: 'unknown_code' });
    if (!known.has(id)) return rejected.push({ line, reason: 'unknown_id' });
    if (inFile.has(id)) return rejected.push({ line, reason: 'duplicate_in_file' });
    inFile.add(id);
    if (done.has(id)) return rejected.push({ line, reason: 'already_recorded' });
    ok.push([id, code]);
  });
  const stmts = ok.map(([id, code]) => env.DB.prepare('INSERT INTO broker_status (list_id, item_id, status, received_at) VALUES (?1, ?2, ?3, ?4)').bind(listId, id, code, now));
  const counts = { 2: 0, 3: 0, 4: 0, 5: 0 };
  ok.forEach(([, c]) => counts[c]++);
  stmts.push(env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(now, 'status.ingested', brokerId, listId, JSON.stringify({ accepted: ok.length, rejected: rejected.length, counts })));
  await batchChunked(env, stmts);
  return { ok: true, accepted: ok.length, rejected, counts, outstanding: known.size - done.size - ok.length };
}
