// Keys earlier versions wrote to localStorage in plain text (records, Texas requests, identifiers/profile, the
// legacy access key). Wiped on every page load. No imports, so main.jsx can call it without pulling the legacy
// dashboard into the production bundle. Tested by scripts/legacy-storage.test.mjs (npm run test:storage).
// This file ships in the production build on purpose (the wipe must run there). Keys are built from a prefix so
// the bundle does not carry the full legacy access-key name, which scripts/check-no-legacy.sh uses as a marker
// for the legacy dashboard code itself (storage.js / App.jsx), which must stay out of production.
const PREFIX = 'privacy-dashboard:';
export const LEGACY_LOCAL_KEYS = ['records:v1', 'txrequests:v1', 'profile:v1', 'access-key'].map((k) => PREFIX + k);
export function clearLegacyStorage(store = globalThis.localStorage) {
  try { for (const k of LEGACY_LOCAL_KEYS) store.removeItem(k); } catch { /* storage unavailable */ }
}
