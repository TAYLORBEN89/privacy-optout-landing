// Texas request client: /api/* paths, 403 reasons, 429 surfaced (not offline), unsent edits kept (npm run test:tx).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
let routes = {}; let calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const key = `${opts.method || 'GET'} ${url}`; calls.push(key);
  let r = routes[key] ?? routes[`${opts.method || 'GET'} *`];
  if (typeof r === 'function') r = r();
  if (!r) throw new TypeError('network down');
  return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers });
};
const { loadTxRequests, saveTxRequest, SessionAuthError, TxRateLimitError } = await import('../src/storage.js');
const { createTxSaver, DEBOUNCE_MS, OFFLINE_RETRY_MS } = await import('../src/txSaver.js');

const ME = { status: 200, body: { mfa: true, csrf_token: 't' } };
beforeEach(() => { routes = {}; calls = []; });

test('uses same-origin /api/me and /api/tx-requests', async () => {
  routes = { 'GET /api/me': ME, 'GET /api/tx-requests': { status: 200, body: [{ id: 'tx-a', status: 'sent' }] } };
  assert.deepEqual(await loadTxRequests(), { map: { 'tx-a': { id: 'tx-a', status: 'sent' } }, online: true });
  routes = { 'PUT /api/tx-requests/tx-a': { status: 200, body: {} } };
  assert.equal(await saveTxRequest({ id: 'tx-a' }), true);
  assert.deepEqual(calls, ['GET /api/me', 'GET /api/tx-requests', 'PUT /api/tx-requests/tx-a']);
});
for (const [name, res, reason] of [
  ['no session', { status: 401, body: { error: 'unauthorized' } }, 'signed_out'],
  ['MFA pending', { status: 403, body: { error: 'mfa required', code: 'mfa_required' } }, 'mfa_required'],
  ['not stepped up', { status: 403, body: { error: 'step_up_required', code: 'step_up_required' } }, 'step_up_required'],
]) {
  test(`${name}: load and save throw SessionAuthError(${reason})`, async () => {
    routes = { 'GET /api/me': res };
    await assert.rejects(loadTxRequests(), (e) => e instanceof SessionAuthError && e.reason === reason);
    routes = { 'PUT /api/tx-requests/tx-a': res };
    await assert.rejects(saveTxRequest({ id: 'tx-a' }), (e) => e instanceof SessionAuthError && e.reason === reason);
  });
}
test('429 is a TxRateLimitError with Retry-After, not offline', async () => {
  routes = { 'PUT /api/tx-requests/tx-a': { status: 429, body: { error: 'too many requests' }, headers: { 'Retry-After': '42' } } };
  await assert.rejects(saveTxRequest({ id: 'tx-a' }), (e) => e instanceof TxRateLimitError && e.retryAfter === 42);
  routes = { 'GET /api/me': ME, 'GET /api/tx-requests': { status: 429, body: {}, headers: { 'Retry-After': '5' } } };
  await assert.rejects(loadTxRequests(), (e) => e instanceof TxRateLimitError);
});
test('network failure is offline (false / online:false)', async () => {
  assert.equal(await saveTxRequest({ id: 'tx-a' }), false);
  assert.deepEqual(await loadTxRequests(), { map: {}, online: false });
});

// ---- txSaver with fake timers ----
function fakeTimers() {
  let t = 0; let seq = 0; const q = new Map();
  return {
    now: () => t,
    setTimeout: (fn, ms) => { const id = ++seq; q.set(id, { at: t + ms, fn }); return id; },
    clearTimeout: (id) => q.delete(id),
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const next = [...q.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        q.delete(next[0]); t = next[1].at; next[1].fn();
        for (let i = 0; i < 10; i++) await Promise.resolve();
      }
      t = end; for (let i = 0; i < 10; i++) await Promise.resolve();
    },
  };
}
test('debounces a broker: typing notes sends one PUT with the last value', async () => {
  const tm = fakeTimers(); const sent = [];
  const s = createTxSaver({ save: async (r) => { sent.push(r); return true; }, timers: tm, now: tm.now });
  for (const n of ['a', 'ab', 'abc']) s.queue({ id: 'tx-a', notes: n });
  await tm.advance(DEBOUNCE_MS);
  assert.deepEqual(sent, [{ id: 'tx-a', notes: 'abc' }]);
  assert.equal(s.pending.size, 0);
  assert.equal(s.state.status, 'idle');
});
test('429 keeps the edit, shows rate_limited with retryAt, retries after Retry-After', async () => {
  const tm = fakeTimers(); let limited = true; const sent = []; const states = [];
  const save = async (r) => { if (limited) throw new TxRateLimitError(30); sent.push(r.id); return true; };
  const s = createTxSaver({ save, timers: tm, now: tm.now, onState: (x) => states.push(x) });
  s.queue({ id: 'tx-a' }); s.queue({ id: 'tx-b' });
  await tm.advance(DEBOUNCE_MS);
  assert.equal(s.state.status, 'rate_limited');
  assert.equal(s.state.retryAt, DEBOUNCE_MS + 30000);
  assert.equal(s.pending.size, 2, 'both edits kept');
  assert.ok(!states.some((x) => x.status === 'offline'), 'never reported as offline');
  limited = false;
  await tm.advance(30000);
  assert.deepEqual(sent.sort(), ['tx-a', 'tx-b']);
  assert.equal(s.pending.size, 0);
  assert.equal(s.state.status, 'idle');
});
test('offline keeps the edit and retries', async () => {
  const tm = fakeTimers(); let up = false;
  const s = createTxSaver({ save: async () => up, timers: tm, now: tm.now });
  s.queue({ id: 'tx-a' });
  await tm.advance(DEBOUNCE_MS);
  assert.equal(s.state.status, 'offline'); assert.equal(s.pending.size, 1);
  up = true; await tm.advance(OFFLINE_RETRY_MS);
  assert.equal(s.pending.size, 0);
});
test('auth failure keeps edits with the reason; flush() after sign-in sends them', async () => {
  const tm = fakeTimers(); let authed = false; const sent = [];
  const save = async (r) => { if (!authed) throw new SessionAuthError('step_up_required'); sent.push(r.id); return true; };
  const s = createTxSaver({ save, timers: tm, now: tm.now });
  s.queue({ id: 'tx-a' });
  await tm.advance(DEBOUNCE_MS);
  assert.deepEqual([s.state.status, s.state.reason, s.pending.size], ['auth', 'step_up_required', 1]);
  authed = true; await s.flush();
  assert.deepEqual(sent, ['tx-a']); assert.equal(s.pending.size, 0);
});
test('a full 445-broker pass stays well under the server tx limit (1 PUT per broker)', async () => {
  const tm = fakeTimers(); let n = 0;
  const s = createTxSaver({ save: async () => { n++; return true; }, timers: tm, now: tm.now });
  for (let i = 0; i < 445; i++) { s.queue({ id: `tx-${i}`, status: 'sent' }); s.queue({ id: `tx-${i}`, status: 'sent', notes: 'x' }); }
  await tm.advance(DEBOUNCE_MS);
  assert.equal(n, 445);
});
