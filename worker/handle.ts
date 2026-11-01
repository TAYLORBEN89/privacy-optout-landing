import { accountsSignInUrl } from "../shared/accounts";
import { validateSignup, type FieldIssue, type SignupIssues } from "../shared/signup";

/**
 * Signup API. Validates and acknowledges. Does not persist.
 * Never log field values, raw bodies, or error messages copied from input.
 *
 * TODO(storage): on success, call saveSignup() from ./storage.ts with the
 * validated value only. No D1/KV binding is configured in this v1.
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

async function handleSignup(request: IncomingHttpRequest): Promise<Response> {
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

  // Validated value is ready for storage and is intentionally discarded.
  // TODO(storage): saveSignup(store, { ...result.value, receivedAt }).
  // Never log result.value.
  void result.value;

  logOutcome({
    message: "signup_accepted",
    method: request.method,
    path: new URL(request.url).pathname,
    status: 200,
  });
  return json({ ok: true }, 200);
}

export async function handleRequest(
  request: IncomingHttpRequest,
  deps: RequestDeps = {},
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/signup") {
    return handleSignup(request);
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
