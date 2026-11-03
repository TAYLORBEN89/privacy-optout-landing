// Client TOTP upgrade (src/authApi.js): 403 mfa_required -> prompt -> POST /api/auth/mfa/verify -> retry once.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../src/authApi.js');

let calls; let server;
beforeEach(() => {
  calls = []; api.setCsrf('csrf-old'); api.setMfaPrompt(null);
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init.method, csrf: init.headers['X-CSRF-Token'], body: init.body && JSON.parse(init.body) });
    const [status, body] = server(url, init);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
});
const MFA403 = [403, { error: 'mfa required', code: 'mfa_required' }];

test('403 mfa_required -> prompt -> verify -> the original request is retried and succeeds', async () => {
  let verified = false; const prompts = [];
  server = (url) => {
    if (url.endsWith('/api/auth/mfa/verify')) { verified = true; return [200, { ok: true, csrf_token: 'csrf-new' }]; }
    return verified ? [200, { sessions: [] }] : MFA403;
  };
  api.setMfaPrompt(async (msg) => { prompts.push(msg); return ' 123456 '; });
  assert.deepEqual(await api.sessions(), { sessions: [] });
  assert.deepEqual(prompts, ['']);
  assert.deepEqual(calls.map((c) => c.url.replace(/^.*\/api/, '/api')), ['/api/account/sessions', '/api/auth/mfa/verify', '/api/account/sessions']);
  assert.deepEqual(calls[1].body, { code: '123456' });
  assert.equal(calls[1].csrf, 'csrf-old');
  // a later state-changing call uses the rotated CSRF token
  server = () => [200, { ok: true }];
  await api.revokeSession('0123456789abcdef');
  assert.equal(calls.at(-1).csrf, 'csrf-new');
});

test('a bad code (401) and a 429 get the same uniform message and a new prompt', async () => {
  const replies = [[401, { error: 'invalid code' }], [429, { error: 'too many attempts' }], [200, { ok: true, csrf_token: 'c' }]];
  let verified = false; const prompts = [];
  server = (url) => {
    if (url.endsWith('/api/auth/mfa/verify')) { const r = replies.shift(); if (r[0] === 200) verified = true; return r; }
    return verified ? [200, { optouts: [] }] : MFA403;
  };
  api.setMfaPrompt(async (msg) => { prompts.push(msg); return '000000'; });
  assert.deepEqual(await api.optouts(), { optouts: [] });
  assert.deepEqual(prompts, ['', api.MFA_RETRY_MESSAGE, api.MFA_RETRY_MESSAGE]);
});

test('cancelling the prompt rethrows the original 403; no prompt registered -> plain 403', async () => {
  server = () => MFA403;
  api.setMfaPrompt(async () => null);
  await assert.rejects(api.sessions(), (e) => e.status === 403 && e.body.code === 'mfa_required');
  api.setMfaPrompt(null);
  await assert.rejects(api.sessions(), (e) => e.status === 403);
  assert.equal(calls.filter((c) => c.url.endsWith('/mfa/verify')).length, 0);
});

test('concurrent 403s share one prompt', async () => {
  let verified = false; let n = 0;
  server = (url) => {
    if (url.endsWith('/api/auth/mfa/verify')) { verified = true; return [200, { ok: true, csrf_token: 'c' }]; }
    return verified ? [200, {}] : MFA403;
  };
  api.setMfaPrompt(async () => { n++; await new Promise((r) => setTimeout(r, 5)); return '123456'; });
  await Promise.all([api.sessions(), api.optouts()]);
  assert.equal(n, 1);
});

// ---- account page decision after /api/me (src/meFlow.js) ----
const { resolveMe, canVerify } = await import('../src/meFlow.js');
const seq = (...xs) => { let i = 0; const f = async () => xs[Math.min(i++, xs.length - 1)]; f.count = () => i; return f; };

test('verifiable limited session: one probe, one re-read of /api/me, then signed in', async () => {
  const me = seq({ limited: true, can_mfa_verify: true }, { limited: false });
  let probes = 0;
  assert.deepEqual((await resolveMe({ me, probe: async () => { probes++; } })).stage, 'signed-in');
  assert.equal(probes, 1); assert.equal(me.count(), 2);
});

test('bounded: still limited after the upgrade -> stops (password stage), no second probe or loop', async () => {
  const me = seq({ limited: true, can_mfa_verify: true }); // server keeps saying limited
  let probes = 0;
  const r = await resolveMe({ me, probe: async () => { probes++; } });
  assert.equal(r.stage, 'password'); assert.equal(probes, 1); assert.equal(me.count(), 2);
});

test('limited password session (mfa/verify would 400): no prompt, no probe, keeps the TOTP-setup path', async () => {
  const u = { limited: true, can_mfa_verify: false, mfa_required: true, auth_method: 'password', user: { totp_enabled: false } };
  assert.equal(canVerify(u), false);
  let probes = 0;
  assert.equal((await resolveMe({ me: seq(u), probe: async () => { probes++; } })).stage, 'enroll');
  assert.equal(probes, 0);
});

test('cancelled prompt: the probe error propagates (caller shows sign-in)', async () => {
  await assert.rejects(resolveMe({ me: seq({ limited: true, can_mfa_verify: true }), probe: async () => { throw new Error('403'); } }));
});
