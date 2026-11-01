import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { inactiveAccounts } from '../src/app.js';
import { hashPassword } from '../src/crypto.js';

const DAY = 86400;
const T = 2_000_000_000;
async function user(email, lastActive, warnedAt = null) {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO users (id, email, pw_hash, created_at, last_active_at, inactivity_warned_at) VALUES (?1, ?2, ?3, 1, ?4, ?5)')
    .bind(id, email, await hashPassword('x'), lastActive, warnedAt).run();
  return id;
}
const exists = async (id) => !!(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?1').bind(id).first());

describe('inactive accounts', () => {
  beforeEach(async () => { await env.DB.batch(['sessions', 'users'].map((t) => env.DB.prepare(`DELETE FROM ${t}`))); });

  it('warns at 23 months via the mail binding (mock), deletes at 24 months only after notice', async () => {
    const send = vi.fn(async () => ({}));
    const e = { ...env, MAILER: { send }, MAIL_FROM: 'no-reply@example.test' };
    const active = await user('active@example.test', T - 10 * DAY);
    const warnMe = await user('warn@example.test', T - 701 * DAY);
    const goneWarned = await user('gone@example.test', T - 731 * DAY, T - 30 * DAY);
    const oldUnwarned = await user('old@example.test', T - 800 * DAY);

    const r = await inactiveAccounts(e, T);
    expect(send).toHaveBeenCalledTimes(2); // warnMe + oldUnwarned
    expect(send.mock.calls.map((c) => c[0].to).sort()).toEqual(['old@example.test', 'warn@example.test']);
    expect(send.mock.calls[0][0].from).toBe('no-reply@example.test');
    expect(r).toEqual({ warned: 2, deleted: 1 });
    expect(await exists(active)).toBe(true);
    expect(await exists(warnMe)).toBe(true);
    expect(await exists(goneWarned)).toBe(false);
    expect(await exists(oldUnwarned)).toBe(true); // just warned; needs the notice period first

    await inactiveAccounts(e, T + 1 * DAY);
    expect(send).toHaveBeenCalledTimes(2); // no duplicate warnings
    expect((await inactiveAccounts(e, T + 15 * DAY)).deleted).toBe(1); // oldUnwarned after 14d notice
    expect(await exists(oldUnwarned)).toBe(false);
  });

  it('without the mail binding nobody is warned or deleted', async () => {
    const id = await user('nomail@example.test', T - 900 * DAY);
    expect(await inactiveAccounts({ ...env, MAILER: undefined }, T)).toEqual({ warned: 0, deleted: 0 });
    expect(await exists(id)).toBe(true);
  });

  it('a failed send does not mark the user warned', async () => {
    const id = await user('fail@example.test', T - 701 * DAY);
    await inactiveAccounts({ ...env, MAILER: { send: async () => { throw new Error('x'); } }, MAIL_FROM: 'a@example.test' }, T);
    expect((await env.DB.prepare('SELECT inactivity_warned_at w FROM users WHERE id = ?1').bind(id).first()).w).toBeNull();
  });

  it('derives the month count in the email from INACTIVE_WARN_DAYS and skips placeholder addresses', async () => {
    const send = vi.fn(async () => ({}));
    const e = { ...env, MAILER: { send }, MAIL_FROM: 'a@example.test', INACTIVE_WARN_DAYS: '365', INACTIVE_DELETE_DAYS: '395' };
    await user('year@example.test', T - 400 * DAY);
    await user(`${crypto.randomUUID()}@users.invalid`, T - 400 * DAY);
    await inactiveAccounts(e, T);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text).toContain('about 12 months');
    expect(send.mock.calls[0][0].text).toContain('within 30 days');
    expect(send.mock.calls[0][0].text).not.toContain('23 months');
  });
});
