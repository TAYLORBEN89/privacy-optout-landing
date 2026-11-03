// Write queue for Texas broker request edits. Each broker's edits are debounced (typing notes = one PUT, not one
// per keystroke) and kept in `pending` until the server stores them, so nothing is silently dropped:
//  - 429 (TxRateLimitError): status 'rate_limited', pause until Retry-After, then retry everything still pending.
//  - unreachable (save returns false): status 'offline', retry after OFFLINE_RETRY_MS.
//  - SessionAuthError: status 'auth' with the reason; edits stay pending and flush() retries after sign-in.
// Pure module (timers injectable) so it is unit-tested in scripts/tx-saver.test.mjs.
import { SessionAuthError, TxRateLimitError } from './storage.js';

export const DEBOUNCE_MS = 800;
export const OFFLINE_RETRY_MS = 15000;

export function createTxSaver({ save, onState = () => {}, timers = globalThis, now = () => Date.now() }) {
  const pending = new Map(); // id -> latest unsent request
  const debounce = new Map(); // id -> timer
  let retryTimer = null; let blocked = null; let inflight = 0;
  let state = { status: 'idle', pending: 0 };
  const emit = (patch) => { state = { ...state, ...patch, pending: pending.size }; onState(state); };

  const schedule = (ms) => {
    if (retryTimer) timers.clearTimeout(retryTimer);
    retryTimer = timers.setTimeout(() => { retryTimer = null; blocked = null; flush(); }, ms);
  };

  async function send(id) {
    const req = pending.get(id);
    if (!req || blocked) return;
    inflight++;
    try {
      const ok = await save(req);
      if (ok) {
        if (pending.get(id) === req) pending.delete(id); // a newer edit made meanwhile stays queued
        if (!blocked) emit({ status: pending.size || inflight > 1 ? 'saving' : 'idle', reason: undefined, retryAt: undefined });
      } else if (!blocked) {
        blocked = 'offline'; emit({ status: 'offline' }); schedule(OFFLINE_RETRY_MS);
      }
    } catch (e) {
      if (e instanceof TxRateLimitError) {
        if (blocked !== 'rate_limited') { blocked = 'rate_limited'; emit({ status: 'rate_limited', retryAt: now() + e.retryAfter * 1000 }); schedule(e.retryAfter * 1000); }
      } else if (e instanceof SessionAuthError) {
        blocked = 'auth'; emit({ status: 'auth', reason: e.reason });
      } else {
        blocked = 'offline'; emit({ status: 'offline' }); schedule(OFFLINE_RETRY_MS);
      }
    } finally { inflight--; }
  }

  async function flush() {
    if (blocked === 'auth') blocked = null; // explicit retry after signing in
    for (const id of [...pending.keys()]) { if (blocked) break; await send(id); }
  }

  function queue(req) {
    pending.set(req.id, req);
    if (debounce.has(req.id)) timers.clearTimeout(debounce.get(req.id));
    debounce.set(req.id, timers.setTimeout(() => { debounce.delete(req.id); send(req.id); }, DEBOUNCE_MS));
    emit(blocked ? {} : { status: 'saving' });
  }

  return { queue, flush, get pending() { return new Map(pending); }, get state() { return state; } };
}
