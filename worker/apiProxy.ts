import { sessionCookieOnly } from "./accountLink";

/**
 * Allowlist of /api routes the frontend calls on the accounts API (src/api.ts,
 * src/api/account.ts, src/Header.tsx). Anything else gets 404 and is never forwarded.
 */
const ROUTES: ReadonlyArray<{ methods: readonly string[]; path: RegExp }> = [
  { methods: ["GET"], path: /^\/api\/me$/ },
  { methods: ["GET"], path: /^\/api\/auth\/complete$/ },
  { methods: ["POST"], path: /^\/api\/auth\/logout$/ },
  { methods: ["POST"], path: /^\/api\/auth\/stepup\/password$/ },
  { methods: ["GET", "POST"], path: /^\/api\/auth\/(google|microsoft)\/stepup$/ },
  { methods: ["GET", "PATCH"], path: /^\/api\/account\/profile$/ },
  { methods: ["GET"], path: /^\/api\/account\/optouts$/ },
  { methods: ["GET"], path: /^\/api\/account\/sessions$/ },
  { methods: ["POST"], path: /^\/api\/account\/sessions\/[A-Za-z0-9_-]{1,80}\/revoke$/ },
  { methods: ["GET", "POST"], path: /^\/api\/account\/export$/ },
  { methods: ["POST"], path: /^\/api\/account\/delete$/ },
  { methods: ["POST"], path: /^\/api\/account\/identities\/(google|microsoft)\/link$/ },
  { methods: ["DELETE"], path: /^\/api\/account\/identities\/(google|microsoft)$/ },
];

export function proxyAllowed(method: string, pathname: string): boolean {
  return ROUTES.some((route) => route.path.test(pathname) && route.methods.includes(method.toUpperCase()));
}

/**
 * Builds the upstream request. Forwards only content-type, accept, x-csrf-token
 * and a validated __Host-sid cookie. Never the raw Cookie, client Authorization,
 * Origin, or any other client header. Origin is set to this Worker's own origin.
 */
export function upstreamRequest(request: {
  url: string;
  method: string;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}): Request {
  const url = new URL(request.url);
  const headers = new Headers();
  for (const name of ["content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value && value.length <= 256) headers.set(name, value);
  }
  const csrf = request.headers.get("x-csrf-token");
  if (csrf && csrf.length <= 256) headers.set("x-csrf-token", csrf);
  const sid = sessionCookieOnly(request.headers.get("cookie") ?? "");
  if (sid) headers.set("cookie", sid);
  headers.set("origin", url.origin);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
    redirect: "manual",
    ...(hasBody && request.body ? { duplex: "half" } : {}),
  } as RequestInit);
}
