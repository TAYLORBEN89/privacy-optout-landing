// Broker delivery: per-broker credentials, the secure download / status-upload API, the monthly list scheduler and
// the gated 24-month retention purge of broker tables. Only hashes, opaque ids and counts leave this module.
// Every D1 query is a literal prepared statement.
import { b64, unb64, randomBytes, timingSafeEqual, decryptPii } from './crypto.js';
import { reserve, clientIp } from './ratelimit.js';
import { log, logAlert } from './log.js';
import { readSignupPayload } from './signupPayload.js';
import { LIST_TYPES, buildList, saveList, ingestStatus, csvOf, sha256HexOf, fileNameOf, STATUS, RESPONSE_WINDOW_DAYS } from './hashEngine.js';

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();
const b64url = (u8) => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hexOf = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const CREDENTIAL_TTL_DAYS = 365;
export const LINK_TTL_SECONDS = 300;
export const MAX_STATUS_BYTES = 5 * 1024 * 1024;
const BROKER_ID = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const TOKEN = /^dtb\.(bk_[0-9a-f]{16})\.([A-Za-z0-9_-]{43})$/;

// ---------- credentials ----------
// Server keys, modeled on INTERNAL_PROXY_KEYS: BROKER_CRED_KEYS is a JSON {kid: base64 key (>= 32 bytes)} secret and
// BROKER_CRED_ACTIVE_KID (a var) names the key used for new credentials, re-wraps and signed links. Keep the previous
// kid in the map during a rotation; remove it only after the key report shows no live credentials on it.
// Stored value: HMAC-SHA256(keys[key_kid], "cred|" + secret).
const KEY_KID = /^[a-z0-9]{1,16}$/;
const keyCache = new WeakMap();
export function loadCredKeys(env) {
  if (keyCache.has(env)) return keyCache.get(env);
  const out = new Map();
  let map = {};
  try { map = JSON.parse(String(env.BROKER_CRED_KEYS || '{}')); } catch { map = {}; }
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    for (const [k, v] of Object.entries(map)) {
      if (!KEY_KID.test(k) || typeof v !== 'string') continue;
      let raw; try { raw = unb64(v); } catch { continue; }
      if (raw.length >= 32) out.set(k, raw);
    }
  }
  keyCache.set(env, out);
  return out;
}
export function activeKeyKid(env) {
  const k = String(env.BROKER_CRED_ACTIVE_KID || '');
  if (!loadCredKeys(env).has(k)) throw new Error('BROKER_CRED_ACTIVE_KID is not a key in BROKER_CRED_KEYS');
  return k;
}
const DUMMY_KEY = new Uint8Array(32);
async function hmacWith(raw, msg) {
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hexOf(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
const hmacHex = async (env, msg) => hmacWith(loadCredKeys(env).get(activeKeyKid(env)), msg);

// Returns { kid, token, expires_at }. The token is shown ONCE to the caller and never stored or logged.
export async function issueCredential(env, brokerId, { at = now(), ttlDays = CREDENTIAL_TTL_DAYS } = {}) {
  const b = await env.DB.prepare('SELECT broker_id FROM delivery_brokers WHERE broker_id = ?1').bind(brokerId).first();
  if (!b) throw new Error('unknown broker');
  const keyKid = activeKeyKid(env);
  const kid = `bk_${hexOf(randomBytes(8))}`;
  const secret = b64url(randomBytes(32));
  const expires = at + ttlDays * DAY;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO broker_credentials (kid, broker_id, secret_hmac, key_kid, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(kid, brokerId, await hmacWith(loadCredKeys(env).get(keyKid), `cred|${secret}`), keyKid, at, expires),
    env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, ?3, NULL, ?4)')
      .bind(at, 'credential.issued', brokerId, JSON.stringify({ kid, expires_at: expires })),
  ]);
  return { kid, token: `dtb.${kid}.${secret}`, expires_at: expires };
}

// Rotation = issueCredential(), hand the new token over, then revokeCredential() the old kid.
export async function revokeCredential(env, brokerId, kid, { at = now() } = {}) {
  const r = await env.DB.prepare('UPDATE broker_credentials SET revoked_at = ?1 WHERE kid = ?2 AND broker_id = ?3 AND revoked_at IS NULL')
    .bind(at, kid, brokerId).run();
  if (r.meta.changes) {
    await env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, ?3, NULL, ?4)')
      .bind(at, 'credential.revoked', brokerId, JSON.stringify({ kid })).run();
  }
  return r.meta.changes === 1;
}

// Bearer dtb.<kid>.<secret> -> { kid, broker_id } or null. Always computes one HMAC and one constant-time compare,
// even for an unknown credential or a removed server key, so timing doesn't reveal which kids exist.
// The HMAC is checked with the key named by the row's key_kid. A valid credential still on a non-active key is
// re-wrapped to the active key (lazy migration; the only non-revocation UPDATE 0013 allows).
export async function authenticateBroker(env, req, at = now()) {
  const h = req.headers.get('Authorization') || '';
  const m = (h.startsWith('Bearer ') ? h.slice(7) : '').match(TOKEN);
  const kid = m ? m[1] : 'bk_0000000000000000';
  const row = await env.DB.prepare(
    `SELECT c.kid, c.broker_id, c.secret_hmac, c.key_kid, c.expires_at, c.revoked_at, d.enabled
     FROM broker_credentials c JOIN delivery_brokers d ON d.broker_id = c.broker_id WHERE c.kid = ?1`,
  ).bind(kid).first();
  const keys = loadCredKeys(env);
  const rowKey = row ? keys.get(row.key_kid) : undefined;
  const msg = `cred|${m ? m[2] : 'x'}`;
  const got = await hmacWith(rowKey || DUMMY_KEY, msg);
  const ok = timingSafeEqual(got, row ? row.secret_hmac : '0'.repeat(64));
  if (!m || !row || !rowKey || !ok || row.revoked_at !== null || row.expires_at <= at || row.enabled !== 1) return null;
  const active = String(env.BROKER_CRED_ACTIVE_KID || '');
  if (row.key_kid !== active && keys.has(active)) {
    try {
      const r = await env.DB.prepare(
        'UPDATE broker_credentials SET secret_hmac = ?1, key_kid = ?2 WHERE kid = ?3 AND key_kid = ?4 AND revoked_at IS NULL',
      ).bind(await hmacWith(keys.get(active), msg), active, row.kid, row.key_kid).run();
      if (r.meta.changes) {
        await env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, ?3, NULL, ?4)')
          .bind(at, 'credential.rewrapped', row.broker_id, JSON.stringify({ kid: row.kid, from: row.key_kid, to: active })).run();
      }
    } catch (e) { log('broker_cred_rewrap', { error: e?.name || 'Error' }); } // auth still succeeds; retried next call
  }
  return { kid: row.kid, broker_id: row.broker_id };
}

// Admin report for key rotation: live (unrevoked, unexpired) credentials per key_kid. Remove an old key from
// BROKER_CRED_KEYS only when its count is 0; any credential still on it stops working once the key is gone.
export async function credentialKeyReport(env, at = now()) {
  const keys = loadCredKeys(env);
  const rows = (await env.DB.prepare(
    'SELECT key_kid, COUNT(*) AS n FROM broker_credentials WHERE revoked_at IS NULL AND expires_at > ?1 GROUP BY key_kid ORDER BY key_kid',
  ).bind(at).all()).results;
  const active = String(env.BROKER_CRED_ACTIVE_KID || '');
  return {
    active_kid: keys.has(active) ? active : null,
    configured_kids: [...keys.keys()].sort(),
    live_by_kid: Object.fromEntries(rows.map((r) => [r.key_kid, r.n])),
    on_old_kids: rows.filter((r) => r.key_kid !== active).reduce((a, r) => a + r.n, 0),
    on_missing_kids: rows.filter((r) => !keys.has(r.key_kid)).reduce((a, r) => a + r.n, 0),
  };
}

// Short-lived signed download link, bound to list + broker + credential + expiry. Signed with the active key, so a
// link issued just before a key switch stops working (5-minute TTL; the broker asks for a new one).
async function linkSig(env, listId, cred, exp) { return hmacHex(env, `link|${listId}|${cred.broker_id}|${cred.kid}|${exp}`); }

// ---------- HTTP ----------
const SEC = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const jsonRes = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...SEC, ...extra } });
const ERR = {
  400: () => jsonRes({ error: 'bad request' }, 400),
  401: () => jsonRes({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' }),
  403: () => jsonRes({ error: 'forbidden' }, 403),
  404: () => jsonRes({ error: 'not found' }, 404),
  413: () => jsonRes({ error: 'too large' }, 413),
  429: (s) => jsonRes({ error: 'rate limited' }, 429, { 'Retry-After': String(s) }),
};
export const isBrokerPath = (p) => p.startsWith('/broker/v1/') || p === '/broker/v1' || p.startsWith('/admin/broker-delivery/');

function adminOk(req, env) {
  const h = req.headers.get('Authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  // BROKER_ADMIN_TOKEN (optional secret) separates broker admin from the legacy API_TOKEN. Once it is set, API_TOKEN
  // no longer works for /admin/broker-delivery/*. Unset today, so API_TOKEN still applies.
  const want = env.BROKER_ADMIN_TOKEN || env.API_TOKEN;
  return !!want && timingSafeEqual(t, want);
}

// Reads a request body as UTF-8, aborting as soon as more than `max` bytes have arrived (Content-Length can lie
// or be absent with chunked uploads). Returns null when over the cap.
async function readCapped(req, max) {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { await reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const all = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.byteLength; }
  return new TextDecoder().decode(all);
}

// A list the broker may download: its own, and complete (all items stored + list.generated audit row written).
async function ownList(env, listId, brokerId) {
  return env.DB.prepare(
    `SELECT l.list_id, l.broker_id, l.list_type, l.version, l.created_at, l.response_due, l.row_count, l.sha256
     FROM broker_lists l
     WHERE l.list_id = ?1 AND l.broker_id = ?2
       AND (SELECT COUNT(*) FROM broker_list_items i WHERE i.list_id = l.list_id) = l.row_count
       AND EXISTS (SELECT 1 FROM broker_hash_audit a WHERE a.list_id = l.list_id AND a.event = 'list.generated')`,
  ).bind(listId, brokerId).first();
}
const manifestOf = (l) => ({
  list_id: l.list_id, broker_id: l.broker_id, list_type: l.list_type, version: l.version, created_at: l.created_at,
  response_due: l.response_due, row_count: l.row_count, file_name: fileNameOf(l.list_id, l.created_at), sha256: l.sha256,
  hash: 'SHA-256/UTF-8/Base64', status_codes: STATUS, response_window_days: RESPONSE_WINDOW_DAYS,
});

async function serveFile(env, list, cred, via, at) {
  const items = (await env.DB.prepare('SELECT item_id, hash FROM broker_list_items WHERE list_id = ?1 ORDER BY item_id').bind(list.list_id).all()).results;
  const csv = csvOf(items);
  if ((await sha256HexOf(csv)) !== list.sha256) { logAlert('broker_list_checksum', { kind: 'mismatch' }); return ERR[404](); }
  await env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(at, 'list.downloaded', cred.broker_id, list.list_id, JSON.stringify({ kid: cred.kid, rows: items.length, via })).run();
  return new Response(csv, { status: 200, headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${fileNameOf(list.list_id, list.created_at)}"`,
    'X-Content-SHA256': list.sha256, 'X-List-Version': String(list.version), ...SEC,
  } });
}

export async function handleBroker(req, env, at = now()) {
  const url = new URL(req.url);
  if (url.protocol !== 'https:') return ERR[403]();
  const rl = await reserve(env, 'broker', clientIp(req), at);
  if (rl.limited) return ERR[429](rl.limited);
  const p = url.pathname;
  const m = req.method;

  // ---- admin (API_TOKEN): roster, issue, revoke. Secrets are returned once in the response body only. ----
  if (p.startsWith('/admin/broker-delivery/')) {
    if (!adminOk(req, env)) return ERR[401]();
    let g;
    if (m === 'POST' && p === '/admin/broker-delivery/brokers') {
      const body = await req.json().catch(() => null);
      const types = String(body?.list_types || 'email,phone,ndz').split(',').map((x) => x.trim()).filter(Boolean);
      if (!body || !BROKER_ID.test(body.broker_id || '') || !types.length || types.some((t) => !LIST_TYPES.includes(t))) return ERR[400]();
      const enabled = body.enabled === false ? 0 : 1;
      await env.DB.prepare(
        `INSERT INTO delivery_brokers (broker_id, list_types, enabled, created_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (broker_id) DO UPDATE SET list_types = excluded.list_types, enabled = excluded.enabled`,
      ).bind(body.broker_id, types.join(','), enabled, at).run();
      return jsonRes({ broker_id: body.broker_id, list_types: types, enabled: !!enabled });
    }
    if (m === 'GET' && p === '/admin/broker-delivery/credential-keys') return jsonRes(await credentialKeyReport(env, at));
    if (m === 'POST' && (g = p.match(/^\/admin\/broker-delivery\/brokers\/([a-z0-9_-]{2,40})\/credentials$/))) {
      try { return jsonRes(await issueCredential(env, g[1], { at }), 201); } catch { return ERR[404](); }
    }
    if (m === 'POST' && (g = p.match(/^\/admin\/broker-delivery\/brokers\/([a-z0-9_-]{2,40})\/credentials\/(bk_[0-9a-f]{16})\/revoke$/))) {
      return (await revokeCredential(env, g[1], g[2], { at })) ? jsonRes({ revoked: g[2] }) : ERR[404]();
    }
    return ERR[404]();
  }

  // ---- signed one-off download link: no bearer needed, expires in LINK_TTL_SECONDS, credential must still be valid ----
  let g = p.match(/^\/broker\/v1\/lists\/([a-z0-9_-]{1,80})\/file$/);
  if (m === 'GET' && g && url.searchParams.has('sig')) {
    const exp = Number(url.searchParams.get('exp'));
    const kid = url.searchParams.get('kid') || '';
    const row = await env.DB.prepare(
      `SELECT c.kid, c.broker_id FROM broker_credentials c JOIN delivery_brokers d ON d.broker_id = c.broker_id
       WHERE c.kid = ?1 AND c.revoked_at IS NULL AND c.expires_at > ?2 AND d.enabled = 1`,
    ).bind(kid, at).first();
    const cred = row || { kid: 'bk_0000000000000000', broker_id: '-' };
    const want = await linkSig(env, g[1], cred, exp);
    if (!row || !Number.isInteger(exp) || exp < at || exp > at + LINK_TTL_SECONDS || !timingSafeEqual(want, url.searchParams.get('sig') || '')) return ERR[401]();
    const list = await ownList(env, g[1], cred.broker_id);
    return list ? serveFile(env, list, cred, 'signed', at) : ERR[404]();
  }

  // ---- bearer-authenticated broker routes ----
  const cred = await authenticateBroker(env, req, at);
  if (!cred) return ERR[401]();
  if (m === 'GET' && p === '/broker/v1/lists') {
    const rows = (await env.DB.prepare(
      `SELECT l.list_id, l.broker_id, l.list_type, l.version, l.created_at, l.response_due, l.row_count, l.sha256 FROM broker_lists l
       WHERE l.broker_id = ?1 AND (SELECT COUNT(*) FROM broker_list_items i WHERE i.list_id = l.list_id) = l.row_count
         AND EXISTS (SELECT 1 FROM broker_hash_audit a WHERE a.list_id = l.list_id AND a.event = 'list.generated')
       ORDER BY l.created_at DESC, l.list_id LIMIT 200`,
    ).bind(cred.broker_id).all()).results;
    return jsonRes({ lists: rows.map(manifestOf) });
  }
  g = p.match(/^\/broker\/v1\/lists\/([a-z0-9_-]{1,80})\/(manifest|file|link|status)$/);
  if (!g) return ERR[404]();
  const [, listId, op] = g;
  const list = await ownList(env, listId, cred.broker_id);
  if (!list) return ERR[404](); // unknown, incomplete and other brokers' lists look the same
  if (m === 'GET' && op === 'manifest') return jsonRes(manifestOf(list));
  if (m === 'GET' && op === 'file') return serveFile(env, list, cred, 'bearer', at);
  if (m === 'POST' && op === 'link') {
    const exp = at + LINK_TTL_SECONDS;
    const q = new URLSearchParams({ kid: cred.kid, exp: String(exp), sig: await linkSig(env, listId, cred, exp) });
    return jsonRes({ url: `${url.origin}/broker/v1/lists/${listId}/file?${q}`, expires_at: exp });
  }
  if (m === 'POST' && op === 'status') {
    const version = Number(url.searchParams.get('version'));
    if (!Number.isInteger(version)) return ERR[400]();
    if (Number(req.headers.get('Content-Length') || 0) > MAX_STATUS_BYTES) return ERR[413]();
    const csv = await readCapped(req, MAX_STATUS_BYTES); // streaming cap: stops reading past the limit
    if (csv === null) return ERR[413]();
    const r = await ingestStatus(env, { credential: cred, listId, version, csv, now: at });
    return jsonRes(r, r.ok ? 200 : 422);
  }
  return ERR[404]();
}

// ---------- monthly scheduler ----------
export const MONTHLY_CRON = '0 9 1 * *';
export const periodOf = (at) => new Date(at * 1000).toISOString().slice(0, 7).replace('-', '');

// Default source: Texas signup requests (kind 'tx', service_id 'signup') that still have their encrypted payload and
// were never listed to this broker for this list type. Decrypted in memory only; nothing raw is returned upstream
// except to buildList, which keeps only hashes. Submissions made for a child are skipped (child signups are off).
export async function loadSignupRecords(env, brokerId, listType) {
  const rows = (await env.DB.prepare(
    `SELECT o.id, p.payload_enc, p.key_version FROM optout_requests o JOIN pii_payloads p ON p.request_id = o.id
     WHERE o.kind = 'tx' AND o.service_id = 'signup'
       AND NOT EXISTS (SELECT 1 FROM broker_list_refs r JOIN broker_lists l ON l.list_id = r.list_id
                       WHERE r.request_ref = o.id AND l.broker_id = ?1 AND l.list_type = ?2
                         AND EXISTS (SELECT 1 FROM broker_hash_audit a WHERE a.list_id = l.list_id AND a.event = 'list.generated'))
     ORDER BY o.id`,
  ).bind(brokerId, listType).all()).results;
  const out = [];
  for (const r of rows) {
    let pl;
    try { pl = readSignupPayload(JSON.parse(await decryptPii(env, r.payload_enc, r.key_version, `pii:${r.id}`))); } catch { continue; }
    if (!pl || pl.submitter === 'child') continue;
    out.push({ request_ref: r.id, first_name: pl.firstName, last_name: pl.lastName, dob: pl.dob, zip: pl.zip, phone: pl.phone, email: pl.email });
  }
  return out;
}

// Builds the next version per enabled broker per list type for the month of `at`. Idempotent: broker_list_runs has
// one row per (broker, type, YYYYMM), written in the same first batch as the list, so a re-run (or a concurrent run)
// in the same month creates nothing new. Months with no new records produce no list.
export async function monthlyLists(env, at = now(), { loadRecords = loadSignupRecords } = {}) {
  const period = periodOf(at);
  const counts = { built: 0, existing: 0, empty: 0, failed: 0 };
  const brokers = (await env.DB.prepare('SELECT broker_id, list_types FROM delivery_brokers WHERE enabled = 1 ORDER BY broker_id').all()).results;
  for (const b of brokers) {
    for (const type of b.list_types.split(',').filter((t) => LIST_TYPES.includes(t))) {
      const run = await env.DB.prepare('SELECT 1 FROM broker_list_runs WHERE broker_id = ?1 AND list_type = ?2 AND period = ?3').bind(b.broker_id, type, period).first();
      if (run) { counts.existing++; continue; }
      try {
        const records = await loadRecords(env, b.broker_id, type);
        if (!records.length) { counts.empty++; continue; }
        const v = await env.DB.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM broker_lists WHERE broker_id = ?1 AND list_type = ?2').bind(b.broker_id, type).first();
        const built = await buildList({ brokerId: b.broker_id, listType: type, version: v.v, createdAt: at, records });
        if (!built.items.length) { counts.empty++; continue; }
        const tail = [env.DB.prepare('INSERT INTO broker_list_runs (broker_id, list_type, period, list_id) VALUES (?1, ?2, ?3, ?4)').bind(b.broker_id, type, period, built.manifest.list_id)];
        await saveList(env, built, { tail, at });
        counts.built++;
      } catch { counts.failed++; }
    }
  }
  if (counts.failed) {
    log('broker_lists', { counts, error: 'list_save_failed' });
    const e = new Error('broker list build failed'); e.counts = counts; throw e; // the cron reports the job as failed
  }
  log('broker_lists', { counts });
  return counts;
}

// ---------- retention purge (broker tables, 24 months) ----------
// "Finished" broker record = a list item whose broker returned a final status (2/3/4/5; finished at received_at), or
// an item that was never answered whose list was created before the cutoff (its 45-day window closed long ago).
// Deletes, oldest first and only below cutoff = at - max(730, FINISHED_RECORD_RETENTION_DAYS) days:
//   broker_status (received_at < cutoff) -> refs/items of lists created < cutoff that have no remaining status ->
//   run ledger + lists left empty -> broker_hash_audit rows (at < cutoff).
// Runs inside one D1 batch that opens the 'broker_purge' gate first and closes it last. The 0013 DELETE triggers
// allow a delete only while that gate is open AND only for rows older than its cutoff, and maintenance_gate itself
// refuses any broker_purge cutoff younger than 730 days by the database clock. dryRun counts and deletes nothing.
// Texas request rows (optout_requests kind 'tx', 3 years) and opt-out rows (24 months) are deleted by the existing
// daily purge() job; those tables are not write-once, so they need no gate.
export async function brokerPurge(env, at = now(), { dryRun = false } = {}) {
  const days = Math.max(730, Number(env.FINISHED_RECORD_RETENTION_DAYS) > 0 ? Number(env.FINISHED_RECORD_RETENTION_DAYS) : 730);
  const cutoff = at - days * DAY;
  const countStmts = [
    env.DB.prepare('SELECT COUNT(*) AS n FROM broker_status WHERE received_at < ?1').bind(cutoff),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM broker_list_items i JOIN broker_lists l ON l.list_id = i.list_id WHERE l.created_at + 7776000 < ?1
       AND NOT EXISTS (SELECT 1 FROM broker_status s WHERE s.list_id = i.list_id AND s.item_id = i.item_id AND s.received_at >= ?1)`).bind(cutoff),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM broker_lists l WHERE l.created_at + 7776000 < ?1
       AND NOT EXISTS (SELECT 1 FROM broker_status s WHERE s.list_id = l.list_id AND s.received_at >= ?1)`).bind(cutoff),
    env.DB.prepare('SELECT COUNT(*) AS n FROM broker_hash_audit WHERE at < ?1').bind(cutoff),
  ];
  if (dryRun) {
    const r = await env.DB.batch(countStmts);
    const counts = { status: r[0].results[0].n, items: r[1].results[0].n, lists: r[2].results[0].n, audit: r[3].results[0].n };
    await env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, NULL, NULL, ?3)')
      .bind(at, 'purge.dry_run', JSON.stringify({ cutoff, ...counts })).run();
    log('broker_purge', { counts, kind: 'dry_run' });
    return { dryRun: true, cutoff, counts };
  }
  const res = await env.DB.batch([
    env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('broker_purge', ?1)").bind(cutoff),
    env.DB.prepare('DELETE FROM broker_status WHERE received_at < ?1').bind(cutoff),
    env.DB.prepare(`DELETE FROM broker_list_refs WHERE list_id IN (SELECT list_id FROM broker_lists WHERE created_at + 7776000 < ?1)
       AND NOT EXISTS (SELECT 1 FROM broker_status s WHERE s.list_id = broker_list_refs.list_id AND s.item_id = broker_list_refs.item_id)`).bind(cutoff),
    env.DB.prepare(`DELETE FROM broker_list_items WHERE list_id IN (SELECT list_id FROM broker_lists WHERE created_at + 7776000 < ?1)
       AND NOT EXISTS (SELECT 1 FROM broker_status s WHERE s.list_id = broker_list_items.list_id AND s.item_id = broker_list_items.item_id)`).bind(cutoff),
    env.DB.prepare(`DELETE FROM broker_list_runs WHERE list_id IN (SELECT list_id FROM broker_lists WHERE created_at + 7776000 < ?1)
       AND NOT EXISTS (SELECT 1 FROM broker_list_items i WHERE i.list_id = broker_list_runs.list_id)`).bind(cutoff),
    env.DB.prepare(`DELETE FROM broker_lists WHERE created_at + 7776000 < ?1 AND NOT EXISTS (SELECT 1 FROM broker_list_items i WHERE i.list_id = broker_lists.list_id)`).bind(cutoff),
    env.DB.prepare('DELETE FROM broker_hash_audit WHERE at < ?1').bind(cutoff),
    env.DB.prepare("DELETE FROM maintenance_gate WHERE name = 'broker_purge'"),
  ]);
  const counts = { status: res[1].meta.changes, items: res[3].meta.changes, refs: res[2].meta.changes, lists: res[5].meta.changes, audit: res[6].meta.changes };
  const total = counts.status + counts.items + counts.refs + counts.lists + counts.audit + res[4].meta.changes;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO broker_hash_audit (at, event, broker_id, list_id, detail) VALUES (?1, ?2, NULL, NULL, ?3)')
      .bind(at, 'purge.completed', JSON.stringify({ cutoff, ...counts })),
    env.DB.prepare("INSERT INTO maintenance_log (job, ran_at, cutoff, deleted) VALUES ('broker_purge', ?1, ?2, ?3)").bind(at, cutoff, total),
  ]);
  log('broker_purge', { counts });
  return { dryRun: false, cutoff, counts };
}

// ---------- signup finish (starts the retention clock) ----------
// A Texas signup row (kind 'tx', service_id 'signup') is finished once EVERY broker list it appears on has closed its
// response window including a possible 45-day extension: list created_at + 90 days. finished_at is set to that moment
// (the latest list's created_at + 90 days), so retention counts from when the last window really closed.
// A signup on no list yet is not finished. Already-finished rows are untouched, so reruns change nothing.
export const SIGNUP_FINISH_DAYS = RESPONSE_WINDOW_DAYS * 2;
export async function finishSignups(env, at = now()) {
  const r = await env.DB.prepare(
    `UPDATE optout_requests
     SET finished_at = (SELECT MAX(l.created_at) FROM broker_list_refs f JOIN broker_lists l ON l.list_id = f.list_id
                        WHERE f.request_ref = optout_requests.id
                          AND EXISTS (SELECT 1 FROM broker_hash_audit a WHERE a.list_id = l.list_id AND a.event = 'list.generated')) + ?2,
         updated_at = ?1
     WHERE kind = 'tx' AND service_id = 'signup' AND finished_at IS NULL
       AND EXISTS (SELECT 1 FROM broker_list_refs f JOIN broker_hash_audit a ON a.list_id = f.list_id AND a.event = 'list.generated'
                   WHERE f.request_ref = optout_requests.id)
       AND NOT EXISTS (SELECT 1 FROM broker_list_refs f JOIN broker_lists l ON l.list_id = f.list_id
                       WHERE f.request_ref = optout_requests.id AND l.created_at + ?2 > ?1
                         AND EXISTS (SELECT 1 FROM broker_hash_audit a WHERE a.list_id = l.list_id AND a.event = 'list.generated'))`,
  ).bind(at, SIGNUP_FINISH_DAYS * DAY).run();
  const finished = r.meta.changes || 0;
  log('signup_finish', { counts: { finished } });
  return { finished };
}
