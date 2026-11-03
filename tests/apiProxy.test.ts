import { describe, expect, it } from "vitest";
import { handleRequest } from "../worker/handle";

function call(path: string, init: RequestInit = {}) {
  let upstream: Request | null = null;
  const promise = handleRequest(new Request(`https://droptexas.com${path}`, init), {
    fetchAsset: async () => new Response("asset"),
    forwardApi: async (r) => {
      upstream = r;
      return new Response("{}", { status: 200 });
    },
  });
  return promise.then((response) => ({ response, upstream: upstream as Request | null }));
}

describe("/api proxy allowlist", () => {
  it("returns 404 and does not forward paths the frontend never calls", async () => {
    for (const [path, method] of [
      ["/api/optouts/signup", "POST"],
      ["/api/admin/users", "GET"],
      ["/api/records", "GET"],
      ["/api/txrequests", "GET"],
      ["/api/me", "DELETE"],
      ["/api/account/sessions/../../x/revoke", "POST"],
      ["/api/account/identities/apple/link", "POST"],
    ] as const) {
      const { response, upstream } = await call(path, { method });
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(upstream, `${method} ${path}`).toBeNull();
    }
  });

  it("forwards only allowlisted headers and a validated session cookie", async () => {
    const { response, upstream } = await call("/api/account/profile", {
      method: "PATCH",
      headers: {
        cookie: "_ga=GA1; __Host-sid=abc123; other=x",
        authorization: "Bearer client-supplied",
        origin: "https://evil.example",
        "x-csrf-token": "csrf-1",
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        "cf-connecting-ip": "1.2.3.4",
      },
      body: JSON.stringify({ phone: null }),
    });
    expect(response.status).toBe(200);
    expect(upstream!.headers.get("cookie")).toBe("__Host-sid=abc123");
    expect(upstream!.headers.get("authorization")).toBeNull();
    expect(upstream!.headers.get("origin")).toBe("https://droptexas.com");
    expect(upstream!.headers.get("x-csrf-token")).toBe("csrf-1");
    expect(upstream!.headers.get("content-type")).toBe("application/json");
    expect(upstream!.headers.get("x-forwarded-for")).toBeNull();
    expect(await upstream!.text()).toBe('{"phone":null}');
  });

  it("drops a malformed session cookie", async () => {
    const { upstream } = await call("/api/me", { headers: { cookie: "__Host-sid=a b<script>" } });
    expect(upstream!.headers.get("cookie")).toBeNull();
  });
});
