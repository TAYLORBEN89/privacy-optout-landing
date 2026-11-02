import { accountsSignInUrl } from "../shared/accounts";
import { validateSignup, type FieldIssue, type SignupInput, type SignupIssues } from "../shared/signup";
import { linkSignupToAccount, sessionUserId, type AccountApi } from "./accountLink";
import { dispatchOptOuts } from "./optouts";
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
  forwardApi?: () => Promise<Response>;
  /** Calls the accounts API with a request this Worker builds. */
  callApi?: AccountApi;
  signupStore?: SignupStore;
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
): Promise<void> {
  if (!api) return;
  const cookie = request.headers.get("cookie") ?? "";
  const csrf = request.headers.get("x-csrf-token") ?? "";
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  try {
    const linked = await linkSignupToAccount(request.url, cookie, csrf, origin, input, api);
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

async function handleSignup(
  request: IncomingHttpRequest,
  store: SignupStore | undefined,
  api: AccountApi | undefined,
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
    const userId = api
      ? await sessionUserId(request.url, request.headers.get("cookie") ?? "", api).catch(() => null)
      : null;
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
    await attachAccount(request, result.value, api);
  }

  logOutcome({
    message: "signup_accepted",
    method: request.method,
    path: new URL(request.url).pathname,
    status: 200,
  });
  return json({ ok: true }, 200);
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
    return handleSignup(request, deps.signupStore, deps.callApi);
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
      },
    });
  }
  if (url.pathname.startsWith("/api/")) {
    if (deps.forwardApi) return deps.forwardApi();
    return json(
      { ok: false, errors: {}, form: { code: "not_found", message: "Not found." } },
      404,
    );
  }
  if (!deps.fetchAsset) {
    return new Response("Not found", { status: 404 });
  }
  return deps.fetchAsset();
}
