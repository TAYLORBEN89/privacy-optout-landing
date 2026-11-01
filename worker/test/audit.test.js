import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { expireAudit } from '../src/app.js';

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const add = (action, at) => env.DB.prepare('INSERT INTO audit_log (user_id, action, at) VALUES (NULL, ?1, ?2)').bind(action, at).run();

describe('audit_log append-only + 12-month expiry', () => {
  it('rejects UPDATE and DELETE outside the expiry job', async () => {
    await add('x.keep', now());
    await expect(env.DB.prepare("UPDATE audit_log SET action = 'tampered' WHERE action = 'x.keep'").run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM audit_log WHERE action = 'x.keep'").run()).rejects.toThrow(/append-only/);
  });

  it('refuses to open the gate for rows newer than 365 days', async () => {
    await expect(env.DB.prepare("INSERT INTO maintenance_gate (name, cutoff) VALUES ('audit_expiry', ?1)").bind(now()).run()).rejects.toThrow(/365 days/);
    expect(await env.DB.prepare('SELECT 1 FROM maintenance_gate').first()).toBeNull();
  });

  it('expires only rows older than 12 months and logs the run', async () => {
    const t = now();
    await add('x.old', t - 400 * DAY);
    await add('x.edge', t - 364 * DAY);
    await add('x.new', t);
    const deleted = await expireAudit({ ...env, AUDIT_RETENTION_DAYS: '30' }, t); // < 365 is clamped to 365
    expect(deleted).toBeGreaterThanOrEqual(1);
    const left = (await env.DB.prepare("SELECT action FROM audit_log WHERE action LIKE 'x.%'").all()).results.map((r) => r.action);
    expect(left).not.toContain('x.old');
    expect(left).toEqual(expect.arrayContaining(['x.edge', 'x.new']));
    const log = await env.DB.prepare("SELECT * FROM maintenance_log WHERE job = 'audit_expiry' ORDER BY id DESC").first();
    expect(log.deleted).toBe(deleted);
    expect(log.cutoff).toBe(t - 365 * DAY);
    expect(await env.DB.prepare('SELECT 1 FROM maintenance_gate').first()).toBeNull(); // gate closed again
    await expect(env.DB.prepare('DELETE FROM maintenance_log').run()).rejects.toThrow(/append-only/);
  });
});
