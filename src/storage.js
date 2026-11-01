// Storage module. The Cloudflare Worker (see /worker) is the source of truth;
// localStorage is only an offline cache used when the API is unreachable.
import { SERVICES } from './services.js';
import { call, ApiError } from './authApi.js';

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

// ---- Texas TDPSA broker requests: per-user D1 rows via the session API (GET /tx-requests, PUT /tx-requests/:id) ----
// Not cached in localStorage (PR #7's no-plaintext rule). These calls use the session cookie, not the legacy key,
// so a 401/403 means "not signed in (with MFA)": it throws SessionAuthError, never the legacy AuthError (which
// would clear the legacy key) and is never reported as "offline".
export class SessionAuthError extends Error {}
const isSessionAuth = (e) => e instanceof ApiError && (e.status === 401 || e.status === 403);

/** Returns { map: {id: request}, online }. */
export async function loadTxRequests() {
  try {
    await call('/me'); // signed-in session (restores CSRF token)
    const list = await call('/tx-requests');
    const map = Object.fromEntries(list.map((r) => [r.id, r]));
    return { map, online: true };
  } catch (e) {
    if (isSessionAuth(e)) throw new SessionAuthError('sign in required');
    return { map: {}, online: false };
  }
}

export async function saveTxRequest(req) {
  try { await call(`/tx-requests/${encodeURIComponent(req.id)}`, { method: 'PUT', body: req }); return true; }
  catch (e) { if (isSessionAuth(e)) throw new SessionAuthError('sign in required'); return false; }
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
