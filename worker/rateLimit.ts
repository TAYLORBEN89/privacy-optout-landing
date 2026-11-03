/**
 * Fixed-window D1 rate limiter for POST /api/signup, ported from the accounts
 * Worker (PRs #22/#23, worker/src/ratelimit.js). Every attempt is reserved first
 * with an atomic UPSERT ... RETURNING, so parallel requests cannot all see
 * "under the limit". Keys are sha256(scope|ip); raw IPs are never stored.
 * No new binding: it uses the existing DB (D1) binding and the rate_limits table.
 */

export const SIGNUP_LIMITS = [
  { scope: "signup_10m", max: 5, windowSec: 600 },
  { scope: "signup_day", max: 20, windowSec: 86_400 },
] as const;

export interface RateLimitDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export interface SignupLimiter {
  /** 0 when allowed, otherwise seconds until retry. Throws on storage errors. */
  reserve(ip: string, at?: number): Promise<number>;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const UPSERT = `INSERT INTO rate_limits (key, window_start, count, expires_at) VALUES (?1, ?2, 1, ?3)
 ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`;

export class D1SignupLimiter implements SignupLimiter {
  constructor(private readonly db: RateLimitDatabase) {}

  async reserve(ip: string, at = Math.floor(Date.now() / 1000)): Promise<number> {
    let retry = 0;
    for (const limit of SIGNUP_LIMITS) {
      const start = Math.floor(at / limit.windowSec) * limit.windowSec;
      const end = start + limit.windowSec;
      const row = await this.db
        .prepare(UPSERT)
        .bind(await sha256Hex(`${limit.scope}|${ip}`), start, end)
        .first<{ count: number }>();
      if (!row || typeof row.count !== "number") throw new Error("rate_limit_unavailable");
      if (row.count > limit.max) retry = Math.max(retry, Math.max(1, end - at));
    }
    // Opportunistic cleanup: the landing Worker has no cron. About 1 in 50 requests.
    if (Math.random() < 0.02) {
      await this.db.prepare("DELETE FROM rate_limits WHERE expires_at < ?1").bind(at).run();
    }
    return retry;
  }
}

export function clientIp(headers: { get(name: string): string | null }): string {
  return headers.get("cf-connecting-ip") || "unknown";
}
