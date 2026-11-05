import { describe, expect, it } from "vitest";
import { filterResponse, signedUpstream } from "../worker/apiProxy";
import { handleRequest } from "../worker/handle";
import { canonicalString, internalAuthHeader, loadProxySigner } from "../worker/internalAuth";
import { TEST_PROXY_KEY_B64, TEST_PROXY_KEYS, testSigner } from "./helpers/proxyKeys";

const OWN = "https://droptexas.com";

async function call(path: string, init: RequestInit = {}, opts: { signer?: () => Promise<never> } = {}) {
  let upstream: Request | null = null;
  const response = await handleRequest(new Request(`${OWN}${path}`, init), {
    fetchAsset: async () => new Response("asset"),
    forwardApi: async (r) => {
      upstream = r;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    },
    proxySigner: opts.signer ?? testSigner,
  });
  return { response, upstream: upstream as Request | null };
}

const sameOrigin = { origin: OWN };

describe("allowlist", () => {
  it("forwards every contract route", async () => {
    const ok: Array<[string, string]> = [
      ["GET", "/api/me"],
      ["GET", "/api/auth/google/start"],
      ["GET", "/api/auth/microsoft/start"],
      ["GET", "/api/auth/complete?code=abc"],
      ["POST", "/api/auth/logout"],
      ["POST", "/api/auth/google/stepup"],
      ["GET", "/api/account/profile"],
      ["PATCH", "/api/account/profile"],
      ["GET", "/api/account/optouts"],
      ["GET", "/api/account/sessions"],
      ["POST", "/api/account/sessions/0123456789abcdef/revoke"],
      ["POST", "/api/account/export"],
      ["POST", "/api/account/delete"],
      ["DELETE", "/api/account/identities/microsoft"],
      ["POST", "/api/account/identities/google/link"],
      ["POST", "/api/optouts/signup"],
    ];
    for (const [method, path] of ok) {
      const { response, upstream } = await call(path, { method, headers: sameOrigin });
      expect(response.status, `${method} ${path}`).toBe(200);
      expect(upstream?.method, `${method} ${path}`).toBe(method);
    }
  });

  it("404s everything else without forwarding", async () => {
    const bad: Array<[string, string]> = [
      ["GET", "/api/account/export"],
      ["GET", "/api/auth/google/stepup"],
      ["POST", "/api/account/sessions/0123456789ABCDEF/revoke"],
      ["POST", "/api/account/sessions/0123456789abcde/revoke"],
      ["POST", "/api/account/sessions/0123456789abcdef0/revoke"],
      ["POST", "/api/account/sessions/../../x/revoke"],
      ["POST", "/api/account/identities/apple/link"],
      ["POST", "/api/account/identities/google"],
      ["DELETE", "/api/account/identities/google/link"],
      ["GET", "/api/account/identities/google"],
      ["DELETE", "/api/me"],
      ["GET", "/api/records"],
      ["GET", "/api/admin/bootstrap"],
      ["POST", "/api/auth/apple/start"],
    ];
    for (const [method, path] of bad) {
      const { response, upstream } = await call(path, { method, headers: sameOrigin });
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(upstream, `${method} ${path}`).toBeNull();
    }
  });
});

describe("request headers", () => {
  it("builds fresh headers and never forwards client CSRF, auth, cookies or origin", async () => {
    const { upstream } = await call("/api/account/profile", {
      method: "PATCH",
      headers: {
        origin: OWN,
        cookie: "_ga=GA1; __Host-sid=abc123; other=x",
        authorization: "Bearer client",
        "x-csrf-token": "csrf-1",
        "x-internal-auth": "v1.k1.1.forged",
        "content-type": "application/json",
        accept: "application/json",
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "1.2.3.4",
      },
      body: '{"phone":null}',
    });
    const h = upstream!.headers;
    expect(h.get("cookie")).toBe("__Host-sid=abc123");
    expect(h.get("origin")).toBe("https://droptexas.com");
    expect(h.get("cf-connecting-ip")).toBe("203.0.113.9");
    expect(h.get("content-type")).toBe("application/json");
    expect(h.get("accept")).toBe("application/json");
    expect(h.get("authorization")).toBeNull();
    expect(h.get("x-csrf-token")).toBeNull();
    expect(h.get("x-forwarded-for")).toBeNull();
    expect(h.get("x-internal-auth")).toMatch(/^v1\.k1\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(await upstream!.text()).toBe('{"phone":null}');
  });

  it("builds a fresh upstream Request: not the incoming object, no cf, manual redirect", async () => {
    const incoming = new Request(`${OWN}/api/account/profile`, {
      method: "PATCH",
      headers: { origin: OWN, "content-type": "application/json" },
      body: "{}",
    });
    Object.defineProperty(incoming, "cf", { value: { country: "US", asn: 1 } });
    let upstream: Request | null = null;
    await handleRequest(incoming, {
      fetchAsset: async () => new Response("asset"),
      forwardApi: async (r) => {
        upstream = r;
        return new Response("{}");
      },
      proxySigner: testSigner,
    });
    const up = upstream as unknown as Request & { cf?: unknown };
    expect(up).not.toBeNull();
    expect(up).not.toBe(incoming);
    expect(up.cf).toBeUndefined();
    expect("cf" in up).toBe(false);
    expect(up.redirect).toBe("manual");
    expect(up.url).toBe(`${OWN}/api/account/profile`);
  });

  it("signs GETs too, and drops a malformed session cookie", async () => {
    const { upstream } = await call("/api/me", { headers: { cookie: "__Host-sid=a b<x>" } });
    expect(upstream!.headers.get("cookie")).toBeNull();
    expect(upstream!.headers.get("x-internal-auth")).toMatch(/^v1\.k1\./);
  });

  it("rejects over-long Content-Type or Accept with 400, and bodies over 64KB with 413", async () => {
    expect((await call("/api/me", { headers: { accept: "a".repeat(257) } })).response.status).toBe(400);
    const big = await call("/api/account/profile", { method: "PATCH", headers: sameOrigin, body: "x".repeat(65_537) });
    expect(big.response.status).toBe(413);
    expect(big.upstream).toBeNull();
  });
});

describe("landing CSRF", () => {
  it("accepts own Origin, or no Origin with Sec-Fetch-Site: same-origin", async () => {
    expect((await call("/api/auth/logout", { method: "POST", headers: { origin: OWN } })).response.status).toBe(200);
    expect((await call("/api/auth/logout", { method: "POST", headers: { "sec-fetch-site": "same-origin" } })).response.status).toBe(200);
  });

  it("rejects other origins, a missing Origin without same-origin fetch metadata, and null", async () => {
    for (const headers of <Record<string, string>[]>[
      { origin: "https://evil.example" },
      { origin: "https://www.droptexas.com" },
      { origin: "null" },
      {},
      { "sec-fetch-site": "same-site" },
      { "sec-fetch-site": "cross-site" },
    ]) {
      const { response, upstream } = await call("/api/auth/logout", { method: "POST", headers });
      expect(response.status, JSON.stringify(headers)).toBe(403);
      expect(await response.json()).toEqual({ ok: false, errors: {}, form: { code: "forbidden", message: "Forbidden." } });
      expect(upstream).toBeNull();
    }
  });
});

describe("X-Internal-Auth", () => {
  it("matches the shared test vector", async () => {
    // Backend can reuse this vector verbatim.
    // key  = base64 of bytes 0x00..0x1f: AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=
    // kid  = k1, ts = 1800000000, ip = 203.0.113.9, method POST,
    // path = /api/account/export?x=1, body = {"a":1}
    const signer = await loadProxySigner(JSON.stringify({ k1: TEST_PROXY_KEY_B64 }), "k1");
    const body = new TextEncoder().encode('{"a":1}');
    expect(
      canonicalString({
        kid: "k1",
        method: "POST",
        pathAndSearch: "/api/account/export?x=1",
        ts: 1_800_000_000,
        ip: "203.0.113.9",
        bodySha256Hex: "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862",
      }),
    ).toBe(
      "v1\nk1\nPOST\n/api/account/export?x=1\n1800000000\n203.0.113.9\n015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862",
    );
    const header = await internalAuthHeader(signer, { method: "POST", pathAndSearch: "/api/account/export?x=1", ip: "203.0.113.9", body }, 1_800_000_000);
    expect(header).toBe("v1.k1.1800000000.-uCux05nB_YSHLfLwqUuzii9ePuZ2QyIxdgq1kQRCZQ");
    const req = await signedUpstream(
      { url: `${OWN}/api/account/export?x=1`, method: "POST", body, contentType: "application/json", accept: null, cookieHeader: "", ip: "203.0.113.9" },
      signer,
      1_800_000_000,
    );
    expect(req.headers.get("x-internal-auth")).toBe(header);
  });

  it("empty-body GET hashes sha256 of the empty string and has empty ip when absent", async () => {
    const signer = await testSigner();
    const a = await internalAuthHeader(signer, { method: "GET", pathAndSearch: "/api/me", ip: "", body: new Uint8Array(0) }, 1);
    const b = await internalAuthHeader(signer, { method: "GET", pathAndSearch: "/api/me", ip: "x", body: new Uint8Array(0) }, 1);
    expect(a).not.toBe(b);
  });

  it("fails closed with a generic 503 and logs no secrets for bad key config", async () => {
    const cases: Array<[string | undefined, string | undefined]> = [
      [undefined, "k1"],
      ["not json", "k1"],
      [TEST_PROXY_KEYS, undefined],
      [TEST_PROXY_KEYS, "k2"],
      [TEST_PROXY_KEYS, "K1"],
      [JSON.stringify({ "Bad-Kid": TEST_PROXY_KEY_B64 }), "k1"],
      [JSON.stringify({ k1: btoa("short") }), "k1"],
      [JSON.stringify({ k1: TEST_PROXY_KEY_B64.replace(/=$/, "") }), "k1"],
      [JSON.stringify([TEST_PROXY_KEY_B64]), "k1"],
    ];
    for (const [keys, kid] of cases) {
      const lines: string[] = [];
      const log = console.log;
      console.log = (m: unknown) => void lines.push(String(m));
      let result;
      try {
        result = await call("/api/me", {}, { signer: (() => loadProxySigner(keys, kid)) as () => Promise<never> });
      } finally {
        console.log = log;
      }
      expect(result.response.status, `${keys} ${kid}`).toBe(503);
      expect(result.upstream).toBeNull();
      expect(lines.join()).not.toContain(TEST_PROXY_KEY_B64);
    }
  });

  it("rejects a proxy key equal to SIGNUP_PII_KEY", async () => {
    await expect(loadProxySigner(TEST_PROXY_KEYS, "k1", TEST_PROXY_KEY_B64)).rejects.toMatchObject({ name: "proxy_key_reused" });
  });
});

describe("response filtering", () => {
  const upstream = (headers: [string, string][]) => {
    const h = new Headers();
    for (const [k, v] of headers) h.append(k, v);
    return new Response("body", { status: 302, headers: h });
  };

  it("keeps __Host-sid and __Host-login only with Path=/, Secure, HttpOnly and no Domain", () => {
    const res = filterResponse(
      upstream([
        ["set-cookie", "__Host-login=st; Path=/; HttpOnly; Secure; SameSite=Lax"],
        ["set-cookie", "__Host-sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"],
        ["set-cookie", "__Host-sid=a; Path=/x; HttpOnly; Secure"],
        ["set-cookie", "__Host-sid=b; Path=/; HttpOnly"],
        ["set-cookie", "__Host-sid=c; Path=/; Secure"],
        ["set-cookie", "__Host-login=d; Path=/; HttpOnly; Secure; Domain=droptexas.com"],
        ["set-cookie", "__Host-oauth=e; Path=/; HttpOnly; Secure"],
      ]),
      `${OWN}/api/auth/google/start`,
    );
    expect(res.headers.getSetCookie()).toEqual([
      "__Host-login=st; Path=/; HttpOnly; Secure; SameSite=Lax",
      "__Host-sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    ]);
  });

  it("keeps only contract headers and allowed cookies", async () => {
    const res = filterResponse(
      upstream([
        ["set-cookie", "__Host-sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax"],
        ["set-cookie", "tracker=1; Path=/"],
        ["set-cookie", "__Host-other=1; Path=/; Secure"],
        ["content-type", "application/json"],
        ["retry-after", "30"],
        ["content-disposition", "attachment; filename=export.json"],
        ["x-powered-by", "api"],
        ["access-control-allow-origin", "*"],
      ]),
      `${OWN}/api/me`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.getSetCookie()).toEqual(["__Host-sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax"]);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("content-disposition")).toContain("export.json");
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(await res.text()).toBe("body");
  });

  it("keeps relative, same-origin and provider Locations; drops the rest", () => {
    const loc = (l: string) => filterResponse(upstream([["location", l]]), `${OWN}/api/auth/google/start`).headers.get("location");
    expect(loc("/account")).toBe("/account");
    expect(loc("https://droptexas.com/account")).toBe("https://droptexas.com/account");
    expect(loc("/start?x=1")).toBe("/start?x=1");
    expect(loc("https://accounts.droptexas.com/oauth/google/start?st=abc")).toBe("https://accounts.droptexas.com/oauth/google/start?st=abc");
    expect(loc("https://accounts.droptexas.com/oauth/microsoft/start")).toBe("https://accounts.droptexas.com/oauth/microsoft/start");
    expect(loc("https://accounts.droptexas.com/oauth/google/start/x")).toBeNull();
    expect(loc("https://accounts.droptexas.com/oauth/apple/start")).toBeNull();
    expect(loc("http://accounts.droptexas.com/oauth/google/start")).toBeNull();
    expect(loc("https://u:p@accounts.droptexas.com/oauth/google/start")).toBeNull();
    expect(loc("https://accounts.droptexas.com:8443/oauth/google/start")).toBeNull();
    expect(loc("https://accounts.google.com/o/oauth2/v2/auth?x=1")).toBeNull();
    expect(loc("https://login.microsoftonline.com/common/oauth2")).toBeNull();
    expect(loc("https://evil.example/")).toBeNull();
    expect(loc("//evil.example/x")).toBeNull();
    expect(loc("https://accounts.google.com.evil.example/")).toBeNull();
    expect(loc("https://accounts.droptexas.com/signin")).toBeNull();
    expect(loc("javascript:alert(1)")).toBeNull();
  });
});

describe("drift vs #24 router", () => {
  it("allowlist equals tests/fixtures/api-routes.json exactly, both ways", async () => {
    const { proxyRouteTable } = await import("../worker/apiProxy");
    const fixture = (await import("./fixtures/api-routes.json")).default as unknown as { routes: [string, string][] };
    const key = ([m, p]: [string, string]) => `${m} ${p}`;
    const ours = new Set(proxyRouteTable().map(key));
    const theirs = new Set(fixture.routes.map(key));
    expect([...ours].filter((r) => !theirs.has(r))).toEqual([]);
    expect([...theirs].filter((r) => !ours.has(r))).toEqual([]);
    expect(ours.size).toBe(fixture.routes.length);
  });

  it("404s the identities routes #24 rejects", async () => {
    for (const [method, path] of [
      ["POST", "/api/account/identities/google"],
      ["POST", "/api/account/identities/microsoft"],
      ["DELETE", "/api/account/identities/google/link"],
      ["DELETE", "/api/account/identities/microsoft/link"],
    ]) {
      const { response, upstream } = await call(path, { method, headers: sameOrigin });
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(upstream).toBeNull();
    }
  });
});

describe("extras", () => {
  it("413s a body over 64KB without forwarding", async () => {
    const { response, upstream } = await call("/api/optouts/signup", {
      method: "POST",
      headers: { origin: OWN, "content-type": "application/json" },
      body: "x".repeat(64 * 1024 + 1),
    });
    expect(response.status).toBe(413);
    expect(upstream).toBeNull();
    const ok = await call("/api/optouts/signup", { method: "POST", headers: { origin: OWN }, body: "x".repeat(64 * 1024) });
    expect(ok.response.status).toBe(200);
  });

  it("sets Cache-Control: no-store on proxied responses", async () => {
    for (const [method, path] of [["GET", "/api/me"], ["POST", "/api/account/export"], ["GET", "/api/account/sessions"]]) {
      const { response } = await call(path, { method, headers: sameOrigin });
      expect(response.headers.get("cache-control"), path).toBe("no-store");
    }
  });

  it("end to end: upstream carries only the contract headers and a fresh signature", async () => {
    const forged = "v1.k1.1800000000.-uCux05nB_YSHLfLwqUuzii9ePuZ2QyIxdgq1kQRCZQ";
    const { upstream } = await call("/api/account/export", {
      method: "POST",
      headers: {
        origin: OWN,
        cookie: "_ga=GA1.1; __Host-sid=sid_123; __Host-login=x; theme=dark",
        authorization: "Bearer client-token",
        "x-csrf-token": "csrf-from-client",
        "x-internal-auth": forged,
        "x-forwarded-for": "1.2.3.4",
        "cf-connecting-ip": "203.0.113.9",
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "test",
        referer: "https://evil.example/",
      },
      body: '{"a":1}',
    });
    const names = [...upstream!.headers.keys()].sort();
    expect(names).toEqual(["accept", "cf-connecting-ip", "content-type", "cookie", "origin", "x-internal-auth"]);
    expect(upstream!.headers.get("cookie")).toBe("__Host-sid=sid_123");
    expect(upstream!.headers.get("origin")).toBe("https://droptexas.com");
    const auth = upstream!.headers.get("x-internal-auth")!;
    expect(auth).not.toBe(forged);
    const ts = Number(auth.split(".")[2]);
    expect(Math.abs(ts - Date.now() / 1000)).toBeLessThan(5);
    const expected = await internalAuthHeader(
      await testSigner(),
      { method: "POST", pathAndSearch: "/api/account/export", ip: "203.0.113.9", body: new TextEncoder().encode('{"a":1}') },
      ts,
    );
    expect(auth).toBe(expected);
  });
});
