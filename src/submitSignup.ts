import {
  readSignupFailure,
  validateSignup,
  type SignupResult,
} from "../shared/signup";

const UNAVAILABLE = {
  ok: false as const,
  errors: {},
  form: {
    code: "unavailable",
    message: "We couldn't reach the server. Try again.",
  },
};

export async function submitSignup(
  input: unknown,
  fetchImpl: typeof fetch = fetch,
  csrfToken?: string | null,
): Promise<SignupResult> {
  const clientResult = validateSignup(input);
  if (!clientResult.ok) {
    return clientResult;
  }

  const body: Record<string, unknown> = { ...clientResult.value };

  let response: Response;
  try {
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
    };
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    response = await fetchImpl("/api/signup", {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    return UNAVAILABLE;
  }

  if (response.ok) {
    return { ok: true, value: clientResult.value };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return UNAVAILABLE;
  }

  return readSignupFailure(payload) ?? UNAVAILABLE;
}
