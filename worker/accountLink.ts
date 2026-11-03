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

export interface AccountApi {
  fetch(request: Request): Promise<Response>;
}

/**
 * Asks the accounts API to store this signup on the signed-in person.
 * No session, or a refusal, leaves the local row in place. Never logs field values.
 */
export async function linkSignupToAccount(
  requestUrl: string,
  cookie: string,
  csrf: string,
  origin: string,
  input: SignupInput,
  api: AccountApi,
): Promise<"linked" | "skipped" | "refused"> {
  const sid = sessionCookieOnly(cookie);
  if (sid.length === 0 || csrf.length === 0 || csrf.length > 256) return "skipped";
  // Origin is this Worker's own origin, never a client-supplied value.
  void origin;
  const url = new URL("/api/optouts/signup", requestUrl);
  const response = await api.fetch(
    new Request(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: sid,
        origin: new URL(requestUrl).origin,
        "x-csrf-token": csrf,
      },
      body: JSON.stringify(accountSignupBody(input)),
    }),
  );
  if (response.status === 200 || response.status === 201) return "linked";
  return "refused";
}

/** Reads only the user id from GET /api/me. Discards the rest of the body. */
export async function sessionUserId(requestUrl: string, cookie: string, api: AccountApi): Promise<string | null> {
  const sid = sessionCookieOnly(cookie);
  if (sid.length === 0) return null;
  const response = await api.fetch(
    new Request(new URL("/api/me", requestUrl), {
      method: "GET",
      headers: { accept: "application/json", cookie: sid },
    }),
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
