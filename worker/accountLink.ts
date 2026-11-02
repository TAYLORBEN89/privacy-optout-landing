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
  if (cookie.length === 0 || csrf.length === 0) return "skipped";
  const url = new URL("/api/optouts/signup", requestUrl);
  const response = await api.fetch(
    new Request(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie,
        origin,
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
  if (!cookie.includes("__Host-sid=")) return null;
  const response = await api.fetch(
    new Request(new URL("/api/me", requestUrl), {
      method: "GET",
      headers: { accept: "application/json", cookie },
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
