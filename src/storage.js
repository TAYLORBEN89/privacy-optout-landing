// Storage module. The Cloudflare Worker (see /worker) is the source of truth;
// localStorage is only an offline cache used when the API is unreachable.
import { SERVICES } from './services.js';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const KEY_STORAGE = 'privacy-dashboard:access-key';

// The access key is entered at runtime (never baked into the bundle) and kept in localStorage.
export const getKey = () => localStorage.getItem(KEY_STORAGE) || '';
export const setKey = (k) => localStorage.setItem(KEY_STORAGE, k.trim());
export const forgetKey = () => localStorage.removeItem(KEY_STORAGE);
export class AuthError extends Error {}
const CACHE_KEY = 'privacy-dashboard:records:v1';

export function defaultRecord(svc) {
  return { id: svc.id, status: 'not_started', url: svc.url, dateSubmitted: '', confirmation: '', notes: svc.notes || '', nextReverify: '' };
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; }
}
function writeCache(map) { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); }

async function api(path, opts = {}) {
  if (!API_URL) throw new Error('VITE_API_URL not set');
  const res = await fetch(API_URL + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey()}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { forgetKey(); throw new AuthError('unauthorized'); }
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function merge(map) {
  return SERVICES.map((s) => ({ ...defaultRecord(s), ...(map[s.id] || {}) }));
}

/** Load all records. Returns { records, online }. */
export async function loadRecords() {
  try {
    const list = await api('/records');
    const map = Object.fromEntries(list.map((r) => [r.id, r]));
    writeCache(map);
    return { records: merge(map), online: true };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    return { records: merge(readCache()), online: false };
  }
}

/** Upsert one record (PUT /records/:id). Cache is updated even if offline. */
export async function saveRecord(record) {
  const map = readCache();
  map[record.id] = record;
  writeCache(map);
  try { await api(`/records/${encodeURIComponent(record.id)}`, { method: 'PUT', body: JSON.stringify(record) }); return true; }
  catch (e) { if (e instanceof AuthError) throw e; return false; }
}

export async function deleteRecord(id) {
  const map = readCache();
  delete map[id];
  writeCache(map);
  try { await api(`/records/${encodeURIComponent(id)}`, { method: 'DELETE' }); return true; }
  catch (e) { if (e instanceof AuthError) throw e; return false; }
}

// ---- Texas TDPSA broker requests (Worker collection /txrequests, KV prefix 'txreq:') ----
const TX_CACHE_KEY = 'privacy-dashboard:txrequests:v1';
const readTx = () => { try { return JSON.parse(localStorage.getItem(TX_CACHE_KEY)) || {}; } catch { return {}; } };
const writeTx = (m) => localStorage.setItem(TX_CACHE_KEY, JSON.stringify(m));

/** Returns { map: {id: request}, online }. */
export async function loadTxRequests() {
  try {
    const list = await api('/txrequests');
    const map = Object.fromEntries(list.map((r) => [r.id, r]));
    writeTx(map);
    return { map, online: true };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    return { map: readTx(), online: false };
  }
}

export async function saveTxRequest(req) {
  const map = readTx(); map[req.id] = req; writeTx(map);
  try { await api(`/txrequests/${encodeURIComponent(req.id)}`, { method: 'PUT', body: JSON.stringify(req) }); return true; }
  catch (e) { if (e instanceof AuthError) throw e; return false; }
}

// ---- Profile (identifiers for request emails). Worker: /settings/profile. Cached locally for offline use. ----
const PROFILE_CACHE = 'privacy-dashboard:profile:v1';
export async function loadProfile() {
  try { const p = await api('/settings/profile'); localStorage.setItem(PROFILE_CACHE, JSON.stringify(p)); return p; }
  catch (e) {
    if (e instanceof AuthError) throw e;
    try { return JSON.parse(localStorage.getItem(PROFILE_CACHE)); } catch { return null; }
  }
}
export async function saveProfile(p) {
  localStorage.setItem(PROFILE_CACHE, JSON.stringify(p));
  await api('/settings/profile', { method: 'PUT', body: JSON.stringify(p) });
}
