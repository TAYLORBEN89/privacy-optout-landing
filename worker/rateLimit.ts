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

// Conditional UPSERT: a request that is already at the limit does not increment
// (the DO UPDATE ... WHERE skips, so RETURNING yields no row). Atomic per window.
const UPSERT = `INSERT INTO rate_limits (key, window_start, count, expires_at) VALUES (?1, ?2, 1, ?3)
 ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 WHERE count < ?4 RETURNING count`;
const REFUND = "UPDATE rate_limits SET count = MAX(count - 1, 0) WHERE key = ?1 AND window_start = ?2";

export class D1SignupLimiter implements SignupLimiter {
  constructor(private readonly db: RateLimitDatabase) {}

  async reserve(ip: string, at = Math.floor(Date.now() / 1000)): Promise<number> {
    const taken: Array<{ key: string; start: number }> = [];
    let retry = 0;
    // Daily window first, then 10 minutes. If a later window rejects, earlier slots are refunded,
    // so a rejected attempt never uses up any cap.
    for (const limit of [...SIGNUP_LIMITS].reverse()) {
      const start = Math.floor(at / limit.windowSec) * limit.windowSec;
      const end = start + limit.windowSec;
      const key = await sha256Hex(`${limit.scope}|${ip}`);
      const row = await this.db.prepare(UPSERT).bind(key, start, end, limit.max).first<{ count: number }>();
      if (row && typeof row.count === "number") {
        taken.push({ key, start });
        continue;
      }
      retry = Math.max(1, end - at);
      break;
    }
    if (retry > 0) {
      for (const slot of taken) await this.db.prepare(REFUND).bind(slot.key, slot.start).run();
      return retry;
    }
    await this.cleanup(at);
    return 0;
  }

  /** Best-effort: never blocks a signup that already passed the limit. Logs no PII. */
  private async cleanup(at: number): Promise<void> {
    if (Math.random() >= 0.02) return;
    try {
      await this.db.prepare("DELETE FROM rate_limits WHERE expires_at < ?1").bind(at).run();
    } catch (error) {
      console.log(JSON.stringify({ message: "rate_limit_cleanup_failed", codes: [error instanceof Error ? error.name : "Error"] }));
    }
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Limiter key for a request. Cloudflare always sets CF-Connecting-IP in production.
 * Missing header: a local dev host gets a dev-only key; anything else returns null,
 * and the caller rejects with a generic 400 instead of sharing one bucket.
 */
export function clientIp(headers: { get(name: string): string | null }, requestUrl: string): string | null {
  const ip = headers.get("cf-connecting-ip")?.trim();
  if (ip && ip.length <= 64) return ip;
  if (LOCAL_HOSTS.has(new URL(requestUrl).hostname)) return "dev-local";
  return null;
}
