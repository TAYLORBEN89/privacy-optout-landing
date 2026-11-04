import { accountsSignInUrl } from "../shared/accounts";
import { validateSignup, type FieldIssue, type SignupInput, type SignupIssues } from "../shared/signup";
import { csrfOk, filterResponse, prepareProxy, proxyAllowed } from "./apiProxy";
import type { ProxySigner } from "./internalAuth";
import { linkSignupToAccount, sessionUserId, type AccountApi } from "./accountLink";
import { dispatchOptOuts } from "./optouts";
import { clientIp, type SignupLimiter } from "./rateLimit";
import { STORAGE_LIVE, saveSignup, type SignupStore } from "./storage";

/**
 * Signup API. Validates, then persists when STORAGE_LIVE.
 * Never log field values, raw bodies, or error messages copied from input.
 */

const MAX_BODY_BYTES = 8_192;

export interface IncomingHttpRequest {
  url: string;
  method: string;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}

export interface RequestDeps {
  fetchAsset?: () => Promise<Response>;
  /**
   * Forwards a non-signup /api request to the backend service binding.
   * Absent means the binding is not configured.
   */
  forwardApi?: (request: Request) => Promise<Response>;
  /** Calls the accounts API with a request this Worker builds. */
  callApi?: AccountApi;
  signupStore?: SignupStore;
  /** D1 limiter for POST /api/signup. The Worker entry always provides it. */
  signupLimiter?: SignupLimiter;
  /** Loads the X-Internal-Auth signer (INTERNAL_PROXY_KEYS + INTERNAL_PROXY_ACTIVE_KID). Throws when invalid. */
  proxySigner?: () => Promise<ProxySigner>;
}

const noSigner = async (): Promise<ProxySigner> => {
  throw new Error("proxy_keys_missing");
};

async function trySigner(get: () => Promise<ProxySigner>): Promise<ProxySigner | null> {
  try {
    return await get();
  } catch {
    return null;
  }
}

interface ErrorBody {
  ok: false;
  errors: SignupIssues;
  form?: FieldIssue;
}

function json(body: { ok: true } | ErrorBody, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

function logOutcome(details: {
  message: string;
  method: string;
  path: string;
  status: number;
  codes?: string[];
}): void {
  console.log(JSON.stringify(details));
}

function formError(
  code: string,
  message: string,
  status: number,
  request: IncomingHttpRequest,
): Response {
  logOutcome({
    message: "signup_rejected",
    method: request.method,
    path: new URL(request.url).pathname,
    status,
    codes: [code],
  });
  return json({ ok: false, errors: {}, form: { code, message } }, status);
}

function allowsLocalDevPort(originHost: string, requestHost: string): boolean {
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  return localHosts.has(originHost) && localHosts.has(requestHost);
}

function originAllowed(request: IncomingHttpRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const requestUrl = new URL(request.url);
  if (originUrl.origin === requestUrl.origin) return true;
  return allowsLocalDevPort(originUrl.hostname, requestUrl.hostname);
}

async function readLimitedText(request: IncomingHttpRequest, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let seen = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      seen += value.byteLength;
      if (seen > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  }
  text += decoder.decode();
  return text;
}

async function attachAccount(
  request: IncomingHttpRequest,
  input: SignupInput,
  api: AccountApi | undefined,
  getSigner: () => Promise<ProxySigner>,
): Promise<void> {
  if (!api || !csrfOk(request)) return;
  const signer = await trySigner(getSigner);
  if (!signer) return;
  const cookie = request.headers.get("cookie") ?? "";
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  try {
    const linked = await linkSignupToAccount(request.url, cookie, ip, input, api, signer);
    if (linked === "skipped") return;
    logOutcome({
      message: linked === "linked" ? "signup_account_linked" : "signup_account_link_failed",
      method: request.method,
      path: new URL(request.url).pathname,
      status: linked === "linked" ? 200 : 502,
    });
  } catch (error) {
    logOutcome({
      message: "signup_account_link_failed",
      method: request.method,
      path: new URL(request.url).pathname,
      status: 502,
      codes: [error instanceof Error ? error.name : "Error"],
    });
  }
}

function rateLimited(retryAfter: number, request: IncomingHttpRequest): Response {
  logOutcome({ message: "signup_rate_limited", method: request.method, path: new URL(request.url).pathname, status: 429 });
  return new Response(
    JSON.stringify({ ok: false, errors: {}, form: { code: "rate_limited", message: "Too many requests. Try again later." } }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": String(retryAfter),
      },
    },
  );
}

/** Verified accounts user, or a 401 that does not store the submission. */
async function requireSignupUser(
  request: IncomingHttpRequest,
  api: AccountApi | undefined,
  getSigner: () => Promise<ProxySigner>,
): Promise<string | Response> {
  const deny = json(
    { ok: false, errors: {}, form: { code: "sign_in_required", message: "Sign in to submit this request." } },
    401,
  );
  if (!api) return deny;
  const signer = await trySigner(getSigner);
  if (!signer) return deny;
  const userId = await sessionUserId(
    request.url,
    request.headers.get("cookie") ?? "",
    request.headers.get("cf-connecting-ip") ?? "",
    api,
    signer,
  ).catch(() => null);
  if (!userId) return deny;
  return userId;
}

async function handleSignup(
  request: IncomingHttpRequest,
  store: SignupStore | undefined,
  api: AccountApi | undefined,
  limiter: SignupLimiter | undefined,
  getSigner: () => Promise<ProxySigner> = noSigner,
): Promise<Response> {
  if (request.method !== "POST") {
    return formError("method_not_allowed", "Use the form on this page to submit.", 405, request);
  }
  if (!originAllowed(request)) {
    return formError("origin_rejected", "Submit the form from this site.", 403, request);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return formError("unsupported_media_type", "Send the form as JSON.", 415, request);
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isFinite(length) || length < 0 || length > MAX_BODY_BYTES) {
      return formError("payload_too_large", "That request is too large.", 413, request);
    }
  }

  const text = await readLimitedText(request, MAX_BODY_BYTES);
  if (text === null) {
    return formError("payload_too_large", "That request is too large.", 413, request);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return formError("invalid_json", "We couldn't read that request. Try again.", 400, request);
  }

  const result = validateSignup(parsed);
  if (!result.ok) {
    const codes = [
      ...Object.entries(result.errors).map(([field, fieldIssue]) => `${field}.${fieldIssue.code}`),
      ...(result.form ? [result.form.code] : []),
    ];
    logOutcome({
      message: "signup_rejected",
      method: request.method,
      path: new URL(request.url).pathname,
      status: 400,
      codes,
    });
    return json(
      result.form
        ? { ok: false, errors: result.errors, form: result.form }
        : { ok: false, errors: result.errors },
      400,
    );
  }

  if (limiter) {
    // Counted only after validation, so fixing form errors does not use up attempts.
    // Fail closed: if the limiter's D1 write fails, the signup write would fail too.
    const ip = clientIp(request.headers, request.url);
    if (ip === null) {
      return formError("bad_request", "We couldn't process that request. Try again.", 400, request);
    }
    let retryAfter: number;
    try {
      retryAfter = await limiter.reserve(ip);
    } catch (error) {
      logOutcome({
        message: "signup_rate_limit_unavailable",
        method: request.method,
        path: new URL(request.url).pathname,
        status: 503,
        codes: [error instanceof Error ? error.name : "Error"],
      });
      return json(
        { ok: false, errors: {}, form: { code: "unavailable", message: "Something went wrong. Try again." } },
        503,
      );
    }
    if (retryAfter > 0) return rateLimited(retryAfter, request);
  }

  const userId = await requireSignupUser(request, api, getSigner);
  if (typeof userId !== "string") return userId;

  if (STORAGE_LIVE) {
    if (!store) {
      logOutcome({
        message: "signup_store_missing",
        method: request.method,
        path: new URL(request.url).pathname,
        status: 503,
      });
      return json(
        { ok: false, errors: {}, form: { code: "unavailable", message: "Something went wrong. Try again." } },
        503,
      );
    }
    let signupId: string;
    try {
      signupId = await saveSignup(store, {
        ...result.value,
        receivedAt: new Date().toISOString(),
        userId,
      });
    } catch (error) {
      logOutcome({
        message: "signup_store_failed",
        method: request.method,
        path: new URL(request.url).pathname,
        status: 500,
        codes: [error instanceof Error ? error.name : "Error"],
      });
      return json(
        { ok: false, errors: {}, form: { code: "unavailable", message: "Something went wrong. Try again." } },
        500,
      );
    }
    try {
      await dispatchOptOuts(store, signupId);
    } catch (error) {
      // The signup row is already stored. D1 errors can echo bound values, so log the name only.
      logOutcome({
        message: "optout_dispatch_failed",
        method: request.method,
        path: new URL(request.url).pathname,
        status: 200,
        codes: [error instanceof Error ? error.name : "Error"],
      });
    }
    await attachAccount(request, result.value, api, getSigner);
  }

  logOutcome({
    message: "signup_accepted",
    method: request.method,
    path: new URL(request.url).pathname,
    status: 200,
  });
  return json({ ok: true }, 200);
}

const PROXY_ERRORS = {
  bad_request: { status: 400, message: "We couldn't process that request. Try again." },
  payload_too_large: { status: 413, message: "That request is too large." },
  forbidden: { status: 403, message: "Forbidden." },
  unavailable: { status: 503, message: "Something went wrong. Try again." },
} as const;

function proxyError(code: keyof typeof PROXY_ERRORS): Response {
  const { status, message } = PROXY_ERRORS[code];
  return json({ ok: false, errors: {}, form: { code, message } }, status);
}

function wwwRedirect(url: URL, method: string): Response | null {
  if (url.hostname !== "www.droptexas.com") return null;
  const status = method === "GET" || method === "HEAD" ? 301 : 308;
  return new Response(null, {
    status,
    headers: {
      location: `https://droptexas.com${url.pathname}${url.search}`,
      "cache-control": "no-store",
    },
  });
}

export async function handleRequest(
  request: IncomingHttpRequest,
  deps: RequestDeps = {},
): Promise<Response> {
  const url = new URL(request.url);
  const redirected = wwwRedirect(url, request.method);
  if (redirected) return redirected;
  if (url.pathname === "/api/signup") {
    return handleSignup(request, deps.signupStore, deps.callApi, deps.signupLimiter, deps.proxySigner);
  }
  if (url.pathname === "/api/auth/apple" || url.pathname.startsWith("/api/auth/apple/")) {
    return json(
      { ok: false, errors: {}, form: { code: "not_found", message: "Not found." } },
      404,
    );
  }
  if (url.pathname === "/signin" || url.pathname === "/signin/") {
    const requested = url.searchParams.get("return_to") ?? "/start";
    return new Response(null, {
      status: 302,
      headers: {
        location: accountsSignInUrl(requested),
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    });
  }
  if (url.pathname.startsWith("/api/")) {
    if (deps.forwardApi && proxyAllowed(request.method, url.pathname)) {
      const prepared = await prepareProxy(request, deps.proxySigner ?? noSigner);
      if (!prepared.ok) return proxyError(prepared.code);
      return filterResponse(await deps.forwardApi(prepared.upstream), request.url);
    }
    return json(
      { ok: false, errors: {}, form: { code: "not_found", message: "Not found." } },
      404,
    );
  }
  if (!deps.fetchAsset) {
    return new Response("Not found", { status: 404 });
  }
  const asset = await deps.fetchAsset();
  if (!privateShell(url.pathname)) return asset;
  const headers = new Headers(asset.headers);
  headers.set("x-robots-tag", "noindex");
  const type = asset.headers.get("content-type") ?? "";
  // 304 (and any non-200) must keep a null body. Reading it and rebuilding the
  // response throws, which the Worker turns into a 500.
  if (asset.status !== 200 || !type.includes("text/html")) {
    return new Response(asset.body, { status: asset.status, headers });
  }
  headers.delete("content-length");
  headers.delete("etag");
  const html = noindexRobotsMeta(await asset.text());
  return new Response(html, { status: 200, headers });
}

const NOINDEX_META = '<meta name="robots" content="noindex, nofollow" />';

/** Match the X-Robots-Tag on shells served for /account/* and /signin/*. */
function noindexRobotsMeta(html: string): string {
  if (/<meta\s+[^>]*name=["']robots["'][^>]*>/i.test(html)) {
    return html.replace(/<meta\s+[^>]*name=["']robots["'][^>]*>/i, NOINDEX_META);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${NOINDEX_META}`);
  }
  return `${NOINDEX_META}${html}`;
}

/** Account and sign-in paths, including SPA fallbacks such as /account/history. */
function privateShell(pathname: string): boolean {
  return pathname === "/account" || pathname.startsWith("/account/") || pathname.startsWith("/signin/");
}
