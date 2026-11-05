import { signedUpstream } from "./apiProxy";
import type { ProxySigner } from "./internalAuth";
import type { SignupInput } from "../shared/signup";

/**
 * Body the accounts API accepts. That service still validates fullName and
 * mailingAddress. The landing store keeps the structured fields.
 */
export function accountSignupBody(input: SignupInput): {
  fullName: string;
  mailingAddress: string;
  email: string;
  phone: string | null;
  texasResident: boolean;
} {
  const fullName = [input.firstName, input.middleName, input.lastName].filter((part) => part && part.length > 0).join(" ");
  const cityLine = `${input.city}, ${input.state} ${input.zip}`;
  const mailingAddress = [input.addressLine1, input.addressLine2, cityLine].filter((part) => part && part.length > 0).join("\n");
  return {
    fullName,
    mailingAddress,
    email: input.email,
    phone: input.phone,
    texasResident: input.texasResident,
  };
}

/**
 * Keeps only the session cookie. Other cookies (analytics, preferences) are
 * never forwarded upstream. Returns "" when there is no valid session cookie.
 */
export function sessionCookieOnly(cookieHeader: string): string {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("__Host-sid=")) {
      const value = trimmed.slice("__Host-sid=".length);
      if (/^[A-Za-z0-9._~+/=-]{1,512}$/.test(value)) return `__Host-sid=${value}`;
      return "";
    }
  }
  return "";
}

const COOKIE_VALUE = /^[A-Za-z0-9._~+/=-]{1,512}$/;

/** Upstream paths that also need the short-lived browser-binding cookie. Only the OAuth callback. */
export const LOGIN_COOKIE_PATHS: readonly string[] = ["/api/auth/complete"];

/**
 * Cookie header for the API Worker: __Host-sid always (when valid), plus
 * __Host-login on GET /api/auth/complete only. Every other cookie is dropped,
 * and a malformed value is never forwarded. Values are never logged.
 */
export function forwardedCookies(cookieHeader: string, method: string, pathname: string): string {
  const wantLogin = method === "GET" && LOGIN_COOKIE_PATHS.includes(pathname);
  const out: string[] = [];
  const sid = sessionCookieOnly(cookieHeader);
  if (sid) out.push(sid);
  if (wantLogin) {
    for (const part of cookieHeader.split(";")) {
      const trimmed = part.trim();
      if (!trimmed.startsWith("__Host-login=")) continue;
      const value = trimmed.slice("__Host-login=".length);
      if (COOKIE_VALUE.test(value)) out.push(`__Host-login=${value}`);
      break;
    }
  }
  return out.join("; ");
}

export interface AccountApi {
  fetch(request: Request): Promise<Response>;
}

/**
 * Asks the accounts API to store this signup on the signed-in person.
 * Signed with X-Internal-Auth; the client's CSRF token is never forwarded.
 * No session, or a refusal, leaves the local row in place. Never logs field values.
 */
export async function linkSignupToAccount(
  requestUrl: string,
  cookie: string,
  ip: string,
  input: SignupInput,
  api: AccountApi,
  signer: ProxySigner,
): Promise<"linked" | "skipped" | "refused"> {
  if (sessionCookieOnly(cookie).length === 0) return "skipped";
  const body = new TextEncoder().encode(JSON.stringify(accountSignupBody(input)));
  const upstream = await signedUpstream(
    {
      url: new URL("/api/optouts/signup", requestUrl).href,
      method: "POST",
      body,
      contentType: "application/json",
      accept: "application/json",
      cookieHeader: cookie,
      ip,
    },
    signer,
  );
  const response = await api.fetch(upstream);
  if (response.status === 200 || response.status === 201) return "linked";
  return "refused";
}

/** Reads only the user id from GET /api/me. Discards the rest of the body. */
export async function sessionUserId(
  requestUrl: string,
  cookie: string,
  ip: string,
  api: AccountApi,
  signer: ProxySigner,
): Promise<string | null> {
  if (sessionCookieOnly(cookie).length === 0) return null;
  const response = await api.fetch(
    await signedUpstream(
      {
        url: new URL("/api/me", requestUrl).href,
        method: "GET",
        body: new Uint8Array(0),
        contentType: null,
        accept: "application/json",
        cookieHeader: cookie,
        ip,
      },
      signer,
    ),
  );
  if (response.status !== 200) return null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const user = (body as { user?: { id?: unknown } }).user;
  return user && typeof user.id === "string" && user.id.length > 0 && user.id.length <= 80 ? user.id : null;
}
