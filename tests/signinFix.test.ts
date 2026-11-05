import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { forwardedCookies } from "../worker/accountLink";
import { proxyAllowed } from "../worker/apiProxy";
import { handleRequest } from "../worker/handle";
import { isSafeReturnPath } from "../shared/accounts";
import { providerStartHref, signInHrefFor } from "../src/authGate";
import { ACCOUNT_PROFILE_PATH } from "../src/api/account";
import { testSigner } from "./helpers/proxyKeys";

const OWN = "https://droptexas.com";
const JAR = "_ga=GA1; __Host-sid=sid_123; __Host-login=login_456; theme=dark";

async function forward(method: string, path: string, cookie: string, upstreamHeaders?: HeadersInit) {
  let sent: Request | null = null;
  const response = await handleRequest(
    new Request(`${OWN}${path}`, { method, headers: { origin: OWN, cookie, "content-type": "application/json" }, body: method === "GET" ? undefined : "{}" }),
    {
      fetchAsset: async () => new Response("asset"),
      forwardApi: async (r) => {
        sent = r;
        return new Response("{}", { status: 200, headers: upstreamHeaders ?? { "content-type": "application/json" } });
      },
      proxySigner: testSigner,
    },
  );
  return { response, sent: sent as Request | null };
}

describe("cookie allowlist", () => {
  it("forwards __Host-sid and __Host-login on GET /api/auth/complete", async () => {
    const { sent } = await forward("GET", "/api/auth/complete?code=x", JAR);
    expect(sent!.headers.get("cookie")).toBe("__Host-sid=sid_123; __Host-login=login_456");
  });

  it("drops __Host-login on every other route", async () => {
    for (const [m, p] of [
      ["GET", "/api/me"],
      ["GET", "/api/auth/google/start"],
      ["POST", "/api/auth/google/stepup"],
      ["POST", "/api/account/identities/microsoft/link"],
      ["DELETE", "/api/account/identities/google"],
      ["PATCH", "/api/account/profile"],
    ] as const) {
      const { sent } = await forward(m, p, JAR);
      expect(sent!.headers.get("cookie"), `${m} ${p}`).toBe("__Host-sid=sid_123");
    }
    expect(forwardedCookies(JAR, "POST", "/api/auth/complete")).toBe("__Host-sid=sid_123");
  });

  it("rejects malformed values and drops other cookies", () => {
    expect(forwardedCookies("__Host-sid=ok; __Host-login=a b<x>", "GET", "/api/auth/complete")).toBe("__Host-sid=ok");
    expect(forwardedCookies(`__Host-login=${"a".repeat(513)}`, "GET", "/api/auth/complete")).toBe("");
    expect(forwardedCookies("__Host-login=ok; other=1", "GET", "/api/auth/complete")).toBe("__Host-login=ok");
    expect(forwardedCookies("a=1; b=2", "GET", "/api/auth/complete")).toBe("");
  });

  it("never logs cookie values", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    await forward("GET", "/api/auth/complete?code=x", JAR);
    forwardedCookies("__Host-login=bad value", "GET", "/api/auth/complete");
    const logged = spies.flatMap((s) => s.mock.calls.flat().map(String)).join("\n");
    spies.forEach((s) => s.mockRestore());
    expect(logged).not.toContain("sid_123");
    expect(logged).not.toContain("login_456");
  });
});

describe("Set-Cookie passthrough", () => {
  const set = "__Host-login=st; Path=/; HttpOnly; Secure; SameSite=Lax";
  it.each([
    ["GET", "/api/auth/google/start"],
    ["GET", "/api/auth/microsoft/start"],
    ["POST", "/api/auth/google/stepup"],
    ["POST", "/api/auth/microsoft/stepup"],
    ["POST", "/api/account/identities/google/link"],
    ["POST", "/api/account/identities/microsoft/link"],
  ])("%s %s returns Set-Cookie unchanged", async (m, p) => {
    const { response } = await forward(m, p, "__Host-sid=s", [["set-cookie", set], ["content-type", "application/json"]]);
    expect(response.headers.getSetCookie()).toEqual([set]);
  });

  it("allows unlink and the profile routes", () => {
    expect(proxyAllowed("DELETE", "/api/account/identities/google")).toBe(true);
    expect(proxyAllowed("GET", "/api/account/profile")).toBe(true);
    expect(proxyAllowed("PATCH", "/api/account/profile")).toBe(true);
  });
});

describe("return_to", () => {
  it("accepts /account and rejects //evil and absolute URLs", () => {
    expect(isSafeReturnPath("/account")).toBe(true);
    for (const bad of ["//evil.example", "https://evil.example/account", "http://droptexas.com/account", "/\\evil.example", "%2F%2Fevil.example"]) {
      expect(isSafeReturnPath(bad), bad).toBe(false);
    }
    expect(signInHrefFor("/account")).toBe("/signin?return_to=%2Faccount");
    expect(providerStartHref("google", "/account")).toBe("/api/auth/google/start?return_to=%2Faccount");
    expect(providerStartHref("google", "//evil.example")).toBe("/api/auth/google/start?return_to=%2Faccount");
  });

  it("header sign-in icon returns to /account and the header has no Menu or nav", () => {
    const src = readFileSync("src/Header.tsx", "utf8");
    expect(src).toContain('signInHrefFor("/account")');
    expect(src).not.toMatch(/header-nav|proposal-link-desktop|>Menu</);
  });
});

describe("profile path", () => {
  it("uses /api/account/profile, not the legacy /api/profile alias", () => {
    expect(ACCOUNT_PROFILE_PATH).toBe("/api/account/profile");
    const src = readFileSync("src/api/account.ts", "utf8");
    expect(src).not.toMatch(/["'`]\/api\/profile/);
  });
});

describe("follow-ups", () => {
  it("rejects POST /api/auth/stepup/password at the proxy", async () => {
    const retiredRoute = ["", "api", "auth", "stepup", "password"].join("/");
    const sessionCookie = `__Host-sid=${crypto.randomUUID()}`;
    expect(proxyAllowed("POST", retiredRoute)).toBe(false);
    const { response, sent } = await forward("POST", retiredRoute, sessionCookie);
    expect(response.status).toBe(404);
    expect(sent).toBeNull();
  });

  it("/signin with no or unsafe return_to sends the provider to /account", () => {
    for (const bad of [null, "", "//evil.example", "https://evil.example/", "/\\evil.example", "/elsewhere"]) {
      expect(providerStartHref("google", bad as string | null), String(bad)).toBe("/api/auth/google/start?return_to=%2Faccount");
    }
    expect(providerStartHref("microsoft", "/start?for=child")).toBe("/api/auth/microsoft/start?return_to=%2Fstart%3Ffor%3Dchild");
  });
});

describe("password step-up removed", () => {
  // Git-tracked files only, so node_modules (e.g. worker/node_modules) is never walked.
  function files(dir: string): string[] {
    return execFileSync("git", ["ls-files", "-z", "--", dir], { encoding: "utf8" }).split("\0").filter(Boolean);
  }
  it("nothing in src or worker references /api/auth/stepup/password", () => {
    const hits = [...files("src"), ...files("worker")].filter((f) => readFileSync(f, "utf8").includes("/api/auth/stepup/password"));
    expect(hits).toEqual([]);
  });
});
