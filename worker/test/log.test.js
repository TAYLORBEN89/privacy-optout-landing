import { SELF } from 'cloudflare:test';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { log, logError, routeOf, scrub } from '../src/log.js';

const SECRETS = ['hunter2-super-secret-password', 'jane.doe@example.test', 'S3cr3tSessionTokenValueAAAAAAAAAAAA', '512-555-0142', '123 Main St'];
afterEach(() => vi.restoreAllMocks());
const capture = () => {
  const lines = [];
  vi.spyOn(console, 'log').mockImplementation((...a) => lines.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a) => lines.push(a.join(' ')));
  return lines;
};

describe('logging helper', () => {
  it('drops non-allowlisted fields and scrubs free text', () => {
    const lines = capture();
    log('request', { method: 'POST', route: '/auth/login', status: 401, body: { password: SECRETS[0] }, cookie: SECRETS[2], email: SECRETS[1] });
    log('x', { error: `failed for ${SECRETS[1]} token ${SECRETS[2]} phone ${SECRETS[3]}` });
    logError('boom', new Error(`address ${SECRETS[4]} ${SECRETS[1]}`));
    const out = lines.join('\n');
    for (const s of SECRETS) expect(out).not.toContain(s);
    expect(JSON.parse(lines[0])).toEqual({ event: 'request', method: 'POST', route: '/auth/login', status: 401 });
    expect(scrub(SECRETS[1])).toBe('[email]');
  });

  it('normalizes routes so ids and user input never appear', () => {
    expect(routeOf('/optouts/0b8f5c3e-1111-4222-8333-944445555666/pii')).toBe('/optouts/:id/pii');
    expect(routeOf('/records/jane.doe@example.test')).toBe('/records/:x');
  });

  it('a real request logs only method/route/status/ms', async () => {
    const lines = capture();
    await SELF.fetch('https://api.test/auth/login?email=jane.doe@example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', Cookie: `__Host-sid=${SECRETS[2]}`, Authorization: `Bearer ${SECRETS[2]}` },
      body: JSON.stringify({ email: SECRETS[1], password: SECRETS[0] }),
    });
    const out = lines.join('\n');
    for (const s of SECRETS) expect(out).not.toContain(s);
    const entry = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((x) => x?.event === 'request');
    expect(Object.keys(entry).sort()).toEqual(['event', 'method', 'ms', 'route', 'status', 'surface']);
  });

  it('logs removed KV paths as not served, and the 403/OPTIONS early returns, without secrets', async () => {
    const lines = capture();
    const gone = await SELF.fetch(`https://api.test/records?key=${SECRETS[2]}`, { headers: { Authorization: `Bearer ${SECRETS[2]}` } });
    expect(gone.status).toBe(404);
    expect(await gone.text()).toBe('Not found');
    for (const path of ['/txrequests/broker1', '/settings/profile']) {
      const res = await SELF.fetch(`https://api.test${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${SECRETS[2]}`, 'Content-Type': 'application/json' }, body: '{"name":"nope"}' });
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Not found');
    }
    await SELF.fetch('https://api.test/me', { headers: { Origin: 'https://evil.example', Cookie: `__Host-sid=${SECRETS[2]}` } });
    await SELF.fetch('https://api.test/me', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
    const out = lines.join('\n');
    for (const s of SECRETS) expect(out).not.toContain(s);
    const reqs = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x) => x?.event === 'request');
    expect(reqs.map((r) => [r.surface, r.status])).toEqual([['app', 404], ['app', 404], ['app', 404], ['app', 403], ['app', 204]]);
    expect(reqs.map((r) => r.route)).toEqual(['/records', '/txrequests/broker1', '/settings/profile', '/me', '/me']);
    expect(reqs.some((r) => r.surface === 'legacy')).toBe(false);
  });
});

describe('blocked redirect (Location guard)', () => {
  it('logs blocked_redirect at error level with only the kind; the response is a 500 and the Location never reaches the log', async () => {
    const { guardLocation } = await import('../src/location.js');
    const out = []; const err = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => out.push(a.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...a) => err.push(a.join(' ')));
    const bad = 'https://evil.example/steal?token=S3cr3tSessionTokenValueAAAAAAAAAAAA';
    const env = { ACCOUNTS_HOST: 'accounts.test', APP_ORIGIN: 'https://app.test' };
    for (const kind of ['app', 'accounts']) {
      const r = guardLocation(env, kind, new Response(null, { status: 302, headers: { Location: bad } }));
      expect(r.status).toBe(500);
      expect(r.headers.get('Location')).toBeNull();
    }
    expect(out).toEqual([]);
    expect(err.map((l) => JSON.parse(l))).toEqual([{ event: 'blocked_redirect', kind: 'app' }, { event: 'blocked_redirect', kind: 'accounts' }]);
    expect(err.join('\n')).not.toContain('evil');
    // An allowed Location passes untouched and logs nothing.
    const ok = guardLocation(env, 'app', new Response(null, { status: 303, headers: { Location: '/account' } }));
    expect(ok.status).toBe(303); expect(err).toHaveLength(2);
  });
  it("'kind' is allowlisted; other fields are still dropped", () => {
    const lines = capture();
    log('x', { kind: 'app', location: 'https://evil.example' });
    expect(JSON.parse(lines[0])).toEqual({ event: 'x', kind: 'app' });
  });
});
