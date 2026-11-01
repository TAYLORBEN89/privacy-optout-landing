// Keys earlier versions wrote to localStorage in plain text (records, Texas requests, identifiers/profile, the
// legacy access key). Wiped on every page load. No imports, so main.jsx can call it without pulling the legacy
// dashboard into the production bundle. Tested by scripts/legacy-storage.test.mjs (npm run test:storage).
export const LEGACY_LOCAL_KEYS = [
  'privacy-dashboard:records:v1', 'privacy-dashboard:txrequests:v1', 'privacy-dashboard:profile:v1',
  'privacy-dashboard:access-key',
];
export function clearLegacyStorage(store = globalThis.localStorage) {
  try { for (const k of LEGACY_LOCAL_KEYS) store.removeItem(k); } catch { /* storage unavailable */ }
}
