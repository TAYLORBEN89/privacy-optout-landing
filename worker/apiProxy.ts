import { forwardedCookies } from "./accountLink";
import { internalAuthHeader, type ProxySigner } from "./internalAuth";

/** Origin sent upstream. Must be in the API Worker's ALLOWED_ORIGIN. */
export const UPSTREAM_ORIGIN = "https://droptexas.com";
export const MAX_PROXY_BODY_BYTES = 65_536;
/** Set-Cookie names passed back to the browser. Backend may add __Host-oauth / __Host-login later. */
export const ALLOWED_RESPONSE_COOKIES: readonly string[] = ["__Host-sid", "__Host-login"];
/** Absolute redirect targets (origin + pathname, exact; any query allowed). */
export const ALLOWED_LOCATION_TARGETS: readonly string[] = [
  "https://accounts.droptexas.com/oauth/google/start",
  "https://accounts.droptexas.com/oauth/microsoft/start",
];
const PASS_HEADERS = ["content-type", "location", "retry-after", "content-disposition"];

const P = "(google|microsoft)";
const ROUTES: ReadonlyArray<{ methods: readonly string[]; path: RegExp }> = [
  { methods: ["GET"], path: /^\/api\/me$/ },
  { methods: ["GET"], path: new RegExp(`^/api/auth/${P}/start$`) },
  { methods: ["GET"], path: /^\/api\/auth\/complete$/ },
  { methods: ["POST"], path: /^\/api\/auth\/logout$/ },
  { methods: ["POST"], path: /^\/api\/auth\/stepup\/password$/ },
  { methods: ["POST"], path: new RegExp(`^/api/auth/${P}/stepup$`) },
  { methods: ["GET", "PATCH"], path: /^\/api\/account\/profile$/ },
  { methods: ["GET"], path: /^\/api\/account\/optouts$/ },
  { methods: ["GET"], path: /^\/api\/account\/sessions$/ },
  { methods: ["POST"], path: /^\/api\/account\/sessions\/[0-9a-f]{16}\/revoke$/ },
  { methods: ["POST"], path: /^\/api\/account\/export$/ },
  { methods: ["POST"], path: /^\/api\/account\/delete$/ },
  { methods: ["DELETE"], path: new RegExp(`^/api/account/identities/${P}$`) },
  { methods: ["POST"], path: new RegExp(`^/api/account/identities/${P}/link$`) },
  { methods: ["POST"], path: /^\/api\/optouts\/signup$/ },
];

/** Flattened [METHOD, path regex source] pairs, for the drift test against #24's router. */
export function proxyRouteTable(): Array<[string, string]> {
  return ROUTES.flatMap((route) => route.methods.map((m): [string, string] => [m, route.path.source.replace(/\\\//g, "/")]));
}

export function proxyAllowed(method: string, pathname: string): boolean {
  return ROUTES.some((route) => route.methods.includes(method) && route.path.test(pathname));
}

type Incoming = {
  url: string;
  method: string;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
};

const SAFE = new Set(["GET", "HEAD"]);

/** Landing-side CSRF: unsafe methods need Origin == own origin, or (no Origin) Sec-Fetch-Site: same-origin. */
export function csrfOk(request: Incoming): boolean {
  if (SAFE.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (origin !== null) return origin === new URL(request.url).origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
}

async function readCapped(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export type ProxyFailure = "bad_request" | "payload_too_large" | "forbidden" | "unavailable";

/** Builds a fresh upstream request: only the contract headers, signed. */
export async function signedUpstream(
  opts: {
    url: string;
    method: string;
    body: Uint8Array;
    contentType: string | null;
    accept: string | null;
    cookieHeader: string;
    ip: string;
  },
  signer: ProxySigner,
  ts?: number,
): Promise<Request> {
  const url = new URL(opts.url);
  const headers = new Headers();
  if (opts.contentType) headers.set("content-type", opts.contentType);
  if (opts.accept) headers.set("accept", opts.accept);
  const cookie = forwardedCookies(opts.cookieHeader, opts.method, url.pathname);
  if (cookie) headers.set("cookie", cookie);
  headers.set("origin", UPSTREAM_ORIGIN);
  if (opts.ip) headers.set("cf-connecting-ip", opts.ip);
  headers.set(
    "x-internal-auth",
    await internalAuthHeader(signer, { method: opts.method, pathAndSearch: url.pathname + url.search, ip: opts.ip, body: opts.body }, ts),
  );
  const hasBody = !SAFE.has(opts.method);
  return new Request(url, {
    method: opts.method,
    headers,
    body: hasBody ? (opts.body as Uint8Array<ArrayBuffer>) : null,
    redirect: "manual",
  });
}

/** Validates and builds the upstream request for a browser call, or returns a failure code. */
export async function prepareProxy(
  request: Incoming,
  getSigner: () => Promise<ProxySigner>,
): Promise<{ ok: true; upstream: Request } | { ok: false; code: ProxyFailure }> {
  if (!csrfOk(request)) return { ok: false, code: "forbidden" };
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  if ((contentType && contentType.length > 256) || (accept && accept.length > 256)) return { ok: false, code: "bad_request" };
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_PROXY_BODY_BYTES) return { ok: false, code: "payload_too_large" };
  const body = SAFE.has(request.method) ? new Uint8Array(0) : await readCapped(request.body, MAX_PROXY_BODY_BYTES);
  if (body === null) return { ok: false, code: "payload_too_large" };
  let signer: ProxySigner;
  try {
    signer = await getSigner();
  } catch (error) {
    console.log(JSON.stringify({ message: "proxy_key_unavailable", codes: [error instanceof Error ? error.name : "Error"] }));
    return { ok: false, code: "unavailable" };
  }
  const upstream = await signedUpstream(
    {
      url: request.url,
      method: request.method,
      body,
      contentType,
      accept,
      cookieHeader: request.headers.get("cookie") ?? "",
      ip: request.headers.get("cf-connecting-ip") ?? "",
    },
    signer,
  );
  return { ok: true, upstream };
}

function locationAllowed(location: string, ownUrl: string): boolean {
  let resolved: URL;
  try {
    resolved = new URL(location, ownUrl);
  } catch {
    return false;
  }
  if (resolved.origin === new URL(ownUrl).origin) return true;
  return resolved.username === "" && resolved.password === "" && resolved.hash === "" &&
    ALLOWED_LOCATION_TARGETS.includes(resolved.origin + resolved.pathname);
}

/** Passes only status, body and the contract headers back to the browser. */
export function filterResponse(response: Response, ownUrl: string): Response {
  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const value = response.headers.get(name);
    if (value === null) continue;
    if (name === "location" && !locationAllowed(value, ownUrl)) continue;
    headers.set(name, value);
  }
  for (const cookie of response.headers.getSetCookie()) {
    const name = cookie.split("=", 1)[0]?.trim() ?? "";
    if (ALLOWED_RESPONSE_COOKIES.includes(name) && cookieAttributesOk(cookie)) headers.append("set-cookie", cookie);
  }
  // Every proxied /api response is per-user or one-shot (sessions, exports, OAuth handoffs): never cache.
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex");
  return new Response(response.body, { status: response.status, headers });
}

/** __Host- rules: Path=/, Secure, HttpOnly, and no Domain. */
export function cookieAttributesOk(cookie: string): boolean {
  const attrs = cookie.split(";").slice(1).map((a) => a.trim().toLowerCase());
  const names = attrs.map((a) => a.split("=", 1)[0]!.trim());
  return attrs.includes("path=/") && names.includes("secure") && names.includes("httponly") && !names.includes("domain");
}
