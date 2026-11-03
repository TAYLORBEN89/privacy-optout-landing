// loadProfile/saveProfile branches: no session vs MFA pending vs step-up required vs network (run: npm run test:storage).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
let routes = {}; let calls = [];
globalThis.fetch = async (url, opts = {}) => {
  calls.push(`${opts.method || 'GET'} ${url}`);
  const r = routes[`${opts.method || 'GET'} ${url}`];
  if (!r) throw new TypeError('network down');
  return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
};
const { loadProfile, saveProfile, ProfileAuthError } = await import('../src/storage.js');
const { SESSION_NOTES } = await import('../src/sessionErrors.js');

const ME = { status: 200, body: { mfa: true, csrf_token: 't' } };
const MFA = { status: 403, body: { error: 'mfa required', code: 'mfa_required' } };
const STEP = { status: 403, body: { error: 'step_up_required', code: 'step_up_required' } };
beforeEach(() => { routes = {}; calls = []; store.clear(); store.set('privacy-dashboard:access-key', 'legacy-key'); });

async function rejectsReason(p, reason) {
  await assert.rejects(p, (e) => e instanceof ProfileAuthError && e.reason === reason);
}

test('session + step-up: loads from /api/profile', async () => {
  routes = { 'GET /api/me': ME, 'GET /api/profile': { status: 200, body: { name: 'Pat' } } };
  assert.deepEqual(await loadProfile(), { profile: { name: 'Pat' }, source: 'session' });
  assert.ok(!calls.some((c) => c.includes('/settings/profile')), 'no legacy call');
});
test('no session (401) and no API_URL: signed_out, no legacy call', async () => {
  routes = { 'GET /api/me': { status: 401, body: { error: 'unauthorized' } } };
  await rejectsReason(loadProfile(), 'signed_out');
  assert.ok(!calls.some((c) => c.includes('/settings')));
});
test('MFA pending (403 mfa_required): mfa_required, never the legacy KV fallback', async () => {
  routes = { 'GET /api/me': MFA };
  await rejectsReason(loadProfile(), 'mfa_required');
  assert.deepEqual(calls, ['GET /api/me']);
});
test('old Worker body without code still maps "mfa required"', async () => {
  routes = { 'GET /api/me': ME, 'GET /api/profile': { status: 403, body: { error: 'mfa required' } } };
  await rejectsReason(loadProfile(), 'mfa_required');
});
test('not stepped up (403 step_up_required): step_up_required, no fallback', async () => {
  routes = { 'GET /api/me': ME, 'GET /api/profile': STEP };
  await rejectsReason(loadProfile(), 'step_up_required');
  assert.ok(!calls.some((c) => c.includes('/settings')));
});
test('other 403 (CSRF/origin) is forbidden, not "signed out"', async () => {
  routes = { 'GET /api/me': ME, 'GET /api/profile': { status: 403, body: { error: 'forbidden' } } };
  await rejectsReason(loadProfile(), 'forbidden');
});
test('network failure / 5xx rethrows as-is (UI shows "server unreachable")', async () => {
  await assert.rejects(loadProfile(), (e) => !(e instanceof ProfileAuthError));
  routes = { 'GET /api/me': ME, 'GET /api/profile': { status: 500, body: { error: 'internal error' } } };
  await assert.rejects(loadProfile(), (e) => !(e instanceof ProfileAuthError) && e.status === 500);
});
test('saveProfile(session): PUT /api/profile; step-up and MFA map to reasons; 5xx rethrown', async () => {
  routes = { 'PUT /api/profile': { status: 200, body: { ok: true } } };
  assert.deepEqual(await saveProfile({ name: 'P' }, 'session'), { ok: true });
  routes = { 'PUT /api/profile': STEP };
  await rejectsReason(saveProfile({}, 'session'), 'step_up_required');
  routes = { 'PUT /api/profile': MFA };
  await rejectsReason(saveProfile({}, 'session'), 'mfa_required');
  routes = { 'PUT /api/profile': { status: 401, body: { error: 'unauthorized' } } };
  await rejectsReason(saveProfile({}, 'session'), 'signed_out');
  routes = { 'PUT /api/profile': { status: 503, body: null } };
  await assert.rejects(saveProfile({}, 'session'), (e) => !(e instanceof ProfileAuthError));
});
test('each reason has its own UI note', () => {
  const notes = ['signed_out', 'mfa_required', 'step_up_required', 'forbidden'].map((r) => SESSION_NOTES[r]);
  assert.equal(new Set(notes).size, 4);
  assert.ok(notes.every(Boolean));
});
