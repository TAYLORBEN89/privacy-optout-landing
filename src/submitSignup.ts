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
): Promise<SignupResult> {
  const clientResult = validateSignup(input);
  if (!clientResult.ok) {
    return clientResult;
  }

  let response: Response;
  try {
    response = await fetchImpl("/api/signup", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(clientResult.value),
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
