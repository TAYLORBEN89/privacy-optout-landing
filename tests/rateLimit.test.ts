import { describe, expect, it } from "vitest";
import { handleRequest } from "../worker/handle";
import { D1SignupLimiter, type RateLimitDatabase } from "../worker/rateLimit";
import type { SignupStore } from "../worker/storage";

/** In-memory stand-in for the rate_limits UPSERT ... RETURNING. */
function fakeDb(): RateLimitDatabase & { keys: string[] } {
  const rows = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              const k = `${values[0]}|${values[1]}`;
              keys.push(String(values[0]));
              const n = (rows.get(k) ?? 0) + 1;
              rows.set(k, n);
              expect(query).toContain("RETURNING count");
              return { count: n } as T;
            },
            async run() {
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
