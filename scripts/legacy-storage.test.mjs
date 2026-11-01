// clearLegacyStorage removes every plaintext key older versions wrote, and the frontend no longer writes
// user data to localStorage (run: npm run test:storage).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearLegacyStorage, LEGACY_LOCAL_KEYS } from '../src/legacyStorage.js';

function fakeStore(init = {}) {
  const m = new Map(Object.entries(init)); const writes = [];
  return { m, writes, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { writes.push(k); m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}

test('removes every legacy key and leaves unrelated keys', () => {
  const init = Object.fromEntries(LEGACY_LOCAL_KEYS.map((k) => [k, 'x']));
  const s = fakeStore({ ...init, theme: 'dark', 'privacy-dashboard:tx-registry': '{}' });
  clearLegacyStorage(s);
  for (const k of LEGACY_LOCAL_KEYS) assert.equal(s.getItem(k), null);
  assert.equal(s.getItem('theme'), 'dark');
  assert.equal(s.writes.length, 0, 'clearing never writes');
});

test('covers records, Texas requests, profile and the access key', () => {
  for (const k of ['records:v1', 'txrequests:v1', 'profile:v1', 'access-key']) {
    assert.ok(LEGACY_LOCAL_KEYS.includes(`privacy-dashboard:${k}`), k);
  }
});

test('never throws when storage is unavailable', () => {
  assert.doesNotThrow(() => clearLegacyStorage({ removeItem() { throw new Error('denied'); } }));
  assert.doesNotThrow(() => clearLegacyStorage(undefined));
});

test('main.jsx wipes on load; storage.js writes no user data to localStorage', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(read('src/main.jsx'), /clearLegacyStorage\(\);/);
  const storage = read('src/storage.js');
  assert.doesNotMatch(storage, /localStorage\.setItem/);
  assert.match(storage, /sessionStorage\.setItem\(KEY_STORAGE/);
});

test('offline is read-only in both editors', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const f of ['src/App.jsx', 'src/TexasBrokers.jsx']) {
    const src = read(f);
    assert.match(src, /if \(!online\) return;/, f);
    assert.match(src, /<fieldset disabled=\{!online\}/, f);
  }
  assert.match(read('src/TexasBrokers.jsx'), /readOnly=\{!profileSource\}/);
});
