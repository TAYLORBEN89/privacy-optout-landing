// Storage module. The Cloudflare Worker (see /worker) is the only store. Nothing about the user (records,
// Texas requests, identifiers/profile) is written to localStorage any more; old plaintext caches are wiped on load.
import { SERVICES } from './services.js';
import { call, ApiError } from './authApi.js';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const KEY_STORAGE = 'privacy-dashboard:access-key';

// Legacy shared access key: per-tab sessionStorage only (gone when the tab closes), until the legacy routes retire.
export const getKey = () => sessionStorage.getItem(KEY_STORAGE) || '';
export const setKey = (k) => sessionStorage.setItem(KEY_STORAGE, k.trim());
export const forgetKey = () => sessionStorage.removeItem(KEY_STORAGE);
export class AuthError extends Error {}

export { LEGACY_LOCAL_KEYS, clearLegacyStorage } from './legacyStorage.js';

export function defaultRecord(svc) {
  return { id: svc.id, status: 'not_started', url: svc.url, dateSubmitted: '', confirmation: '', notes: svc.notes || '', nextReverify: '' };
}


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
    return { records: merge(map), online: true };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    return { records: merge({}), online: false };
  }
}

/** Upsert one record (PUT /records/:id). Returns false if the API is unreachable (nothing stored locally). */
export async function saveRecord(record) {
  try { await api(`/records/${encodeURIComponent(record.id)}`, { method: 'PUT', body: JSON.stringify(record) }); return true; }
  catch (e) { if (e instanceof AuthError) throw e; return false; }
}

export async function deleteRecord(id) {
  try { await api(`/records/${encodeURIComponent(id)}`, { method: 'DELETE' }); return true; }
  catch (e) { if (e instanceof AuthError) throw e; return false; }
}

// ---- Texas TDPSA broker requests (Worker collection /txrequests, KV prefix 'txreq:') ----

/** Returns { map: {id: request}, online }. */
export async function loadTxRequests() {
  try {
    const list = await api('/txrequests');
    const map = Object.fromEntries(list.map((r) => [r.id, r]));
    return { map, online: true };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    return { map: {}, online: false };
  }
}

export async function saveTxRequest(req) {
  try { await api(`/txrequests/${encodeURIComponent(req.id)}`, { method: 'PUT', body: JSON.stringify(req) }); return true; }
  catch (e) { if (e instanceof AuthError) throw e; return false; }
}

// ---- Profile (identifiers for request emails). Never cached in the browser.
// Signed-in session (D1, encrypted at rest): GET/PUT /profile. Users who only have the legacy shared key (not yet
// migrated) fall back to the legacy KV route /settings/profile, so they keep access until the KV->D1 migration.
// loadProfile resolves { profile, source: 'session' | 'legacy' }. It throws ProfileAuthError when neither a session
// nor a legacy key is available, AuthError when the legacy key is rejected, and rethrows anything else (network, 5xx) so the UI can tell the two apart.
export class ProfileAuthError extends Error {}
const isAuthStatus = (e) => e instanceof ApiError && (e.status === 401 || e.status === 403);
export async function loadProfile() {
  try {
    await call('/me'); // restores the in-memory CSRF token after a reload (needed for the PUT)
    return { profile: await call('/profile'), source: 'session' };
  } catch (e) {
    if (!isAuthStatus(e)) throw e;
  }
  if (!getKey() || !API_URL) throw new ProfileAuthError('sign in required');
  // A rejected legacy key throws AuthError (key cleared), which the page routes to onAuthFail as before.
  return { profile: await api('/settings/profile'), source: 'legacy' };
}
export const saveProfile = (p, source) => (source === 'legacy'
  ? api('/settings/profile', { method: 'PUT', body: JSON.stringify(p) })
  : call('/profile', { method: 'PUT', body: p }));
