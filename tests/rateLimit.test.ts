import { describe, expect, it } from "vitest";
import { handleRequest } from "../worker/handle";
import { D1SignupLimiter, type RateLimitDatabase } from "../worker/rateLimit";
import type { SignupStore } from "../worker/storage";

/** In-memory stand-in for rate_limits: conditional UPSERT ... RETURNING, refund, cleanup. */
function fakeDb(opts: { failDelete?: boolean } = {}): RateLimitDatabase & { keys: string[]; rows: Map<string, number> } {
  const rows = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    rows,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          const k = `${values[0]}|${values[1]}`;
          return {
            async first<T>() {
              expect(query).toContain("WHERE count < ?4 RETURNING count");
              keys.push(String(values[0]));
              const cur = rows.get(k);
              if (cur === undefined) {
                rows.set(k, 1);
                return { count: 1 } as T;
              }
              if (cur >= Number(values[3])) return null;
              rows.set(k, cur + 1);
              return { count: cur + 1 } as T;
            },
            async run() {
              if (query.startsWith("DELETE")) {
                if (opts.failDelete) throw new Error("D1_ERROR: 203.0.113.9");
                return {};
              }
              if (query.startsWith("UPDATE")) rows.set(k, Math.max((rows.get(k) ?? 0) - 1, 0));
              return {};
            },
          };
        },
      };
    },
  };
}

const valid = {
  firstName: "Ada", middleName: "", lastName: "Lovelace", dob: "1990-01-15",
  addressLine1: "123 Main St", addressLine2: "", city: "Austin", state: "TX", zip: "78701",
  email: "ada@example.com", phone: "", texasResident: true, submitter: "self",
};

const store: SignupStore = { save: async () => "s-1", saveOptOuts: async () => undefined };

function post(ip: string, body: unknown = valid): Request {
  return new Request("https://optout.example/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://optout.example", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

describe("D1SignupLimiter", () => {
  it("allows 5 per 10 minutes, then returns a Retry-After to the window end", async () => {
    const limiter = new D1SignupLimiter(fakeDb());
    const at = 1_800_000_000;
    for (let i = 0; i < 5; i += 1) expect(await limiter.reserve("203.0.113.9", at)).toBe(0);
    const retry = await limiter.reserve("203.0.113.9", at);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(600);
    expect(await limiter.reserve("198.51.100.1", at)).toBe(0);
  });

  it("caps at 20 per day across 10-minute windows", async () => {
    const limiter = new D1SignupLimiter(fakeDb());
    const day = 1_800_000_000 - (1_800_000_000 % 86_400);
    let allowed = 0;
    for (let w = 0; w < 6; w += 1) {
      for (let i = 0; i < 5; i += 1) if ((await limiter.reserve("203.0.113.9", day + w * 600)) === 0) allowed += 1;
    }
    expect(allowed).toBe(20);
  });

  it("never stores the raw IP", async () => {
    const db = fakeDb();
    await new D1SignupLimiter(db).reserve("203.0.113.9");
    expect(db.keys.join()).not.toContain("203.0.113.9");
    expect(db.keys[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("rejected attempts and cleanup", () => {
  it("over-limit retries do not use up the daily cap", async () => {
    const db = fakeDb();
    const limiter = new D1SignupLimiter(db);
    const day = 1_800_000_000 - (1_800_000_000 % 86_400);
    for (let i = 0; i < 5; i += 1) expect(await limiter.reserve("203.0.113.9", day)).toBe(0);
    for (let i = 0; i < 50; i += 1) expect(await limiter.reserve("203.0.113.9", day)).toBeGreaterThan(0);
    const counts = [...db.rows.values()].sort((x, y) => x - y);
    expect(counts).toEqual([5, 5]);
    // The next 10-minute window still has its full 5.
    for (let i = 0; i < 5; i += 1) expect(await limiter.reserve("203.0.113.9", day + 600)).toBe(0);
  });

  it("a failing cleanup DELETE does not block an allowed signup", async () => {
    const random = Math.random;
    Math.random = () => 0;
    const lines: string[] = [];
    const log = console.log;
    console.log = (m: unknown) => void lines.push(String(m));
    try {
      expect(await new D1SignupLimiter(fakeDb({ failDelete: true })).reserve("203.0.113.9")).toBe(0);
    } finally {
      Math.random = random;
      console.log = log;
    }
    expect(lines.join()).toContain("rate_limit_cleanup_failed");
    expect(lines.join()).not.toContain("203.0.113.9");
  });
});

describe("client IP key", () => {
  it("rejects a production request without CF-Connecting-IP with a generic 400", async () => {
    let calls = 0;
    const res = await handleRequest(
      new Request("https://droptexas.com/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://droptexas.com" },
        body: JSON.stringify(valid),
      }),
      { signupStore: store, signupLimiter: { reserve: async () => { calls += 1; return 0; } } },
    );
    expect(res.status).toBe(400);
    expect(calls).toBe(0);
  });

  it("uses a dev-only key on localhost", async () => {
    const seen: string[] = [];
    const res = await handleRequest(
      new Request("http://localhost:8787/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8787" },
        body: JSON.stringify(valid),
      }),
      { signupStore: store, signupLimiter: { reserve: async (ip) => { seen.push(ip); return 0; } } },
    );
    expect(res.status).toBe(200);
    expect(seen).toEqual(["dev-local"]);
  });
});

describe("POST /api/signup rate limit", () => {
  it("returns a uniform 429 with Retry-After and no detail", async () => {
    const signupLimiter = { reserve: async () => 321 };
    const res = await handleRequest(post("203.0.113.9"), { signupStore: store, signupLimiter });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("321");
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ ok: false, errors: {}, form: { code: "rate_limited", message: "Too many requests. Try again later." } });
    expect(body).not.toMatch(/203\.0|signup_10m|signup_day|count/);
  });

  it("fails closed with a generic 503 when the limiter errors", async () => {
    let saved = 0;
    const signupLimiter = { reserve: async () => { throw new Error("D1_ERROR: secret detail"); } };
    const res = await handleRequest(post("203.0.113.9"), {
      signupStore: { save: async () => { saved += 1; return "s"; }, saveOptOuts: async () => undefined },
      signupLimiter,
    });
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("secret detail");
    expect(saved).toBe(0);
  });

  it("does not count invalid submissions", async () => {
    let calls = 0;
    const signupLimiter = { reserve: async () => { calls += 1; return 0; } };
    const res = await handleRequest(post("203.0.113.9", { ...valid, email: "" }), { signupStore: store, signupLimiter });
    expect(res.status).toBe(400);
    expect(calls).toBe(0);
  });
});
