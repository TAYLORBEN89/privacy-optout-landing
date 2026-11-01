export const SIGNUP_FIELDS = ["fullName", "mailingAddress", "email", "texasResident"] as const;

export type SignupField = (typeof SIGNUP_FIELDS)[number];

/** Law label applied to every accepted signup until more states are supported. */
export const JURISDICTION_TDPSA = "TDPSA" as const;

export type Jurisdiction = typeof JURISDICTION_TDPSA;

export interface SignupInput {
  fullName: string;
  mailingAddress: string;
  email: string;
  texasResident: boolean;
  /** Always TDPSA for now, including when the Texas box is unchecked. */
  jurisdiction: Jurisdiction;
  /** True when the person said they do not live in Texas. */
  nonTexasFlag: boolean;
}

export interface FieldIssue {
  code: string;
  message: string;
}

export type SignupIssues = Partial<Record<SignupField, FieldIssue>>;

export type SignupResult =
  | { ok: true; value: SignupInput }
  | { ok: false; errors: SignupIssues; form?: FieldIssue };

const NAME_MAX = 120;
const ADDRESS_MIN = 10;
const ADDRESS_MAX = 400;
const EMAIL_MAX = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F<>]/;

function issue(code: string, message: string): FieldIssue {
  return { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateFullName(value: unknown): { value: string } | { error: FieldIssue } {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: issue("required", "Enter your full name.") };
  }
  const fullName = value.trim().replace(/\s+/g, " ");
  if (FORBIDDEN_CHARS.test(fullName)) {
    return { error: issue("invalid", "Use letters in your name. Remove characters like < or >.") };
  }
  if (fullName.length > NAME_MAX) {
    return { error: issue("too_long", "Enter a shorter name (120 characters or fewer).") };
  }
  if (!/\p{L}/u.test(fullName)) {
    return { error: issue("invalid", "Use letters in your name. Remove characters like < or >.") };
  }
  if (fullName.split(" ").length < 2) {
    return { error: issue("incomplete", "Enter a first and last name.") };
  }
  return { value: fullName };
}

function validateMailingAddress(value: unknown): { value: string } | { error: FieldIssue } {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: issue("required", "Enter your mailing address.") };
  }
  const mailingAddress = value.trim().replace(/\r\n/g, "\n");
  if (FORBIDDEN_CHARS.test(mailingAddress)) {
    return {
      error: issue("invalid", "Remove characters like < or > from the mailing address."),
    };
  }
  if (mailingAddress.length > ADDRESS_MAX) {
    return {
      error: issue("too_long", "Enter a shorter mailing address (400 characters or fewer)."),
    };
  }
  if (mailingAddress.length < ADDRESS_MIN || !/\p{L}/u.test(mailingAddress)) {
    return {
      error: issue("too_short", "Enter a street, city, state, and ZIP code."),
    };
  }
  return { value: mailingAddress };
}

function validateEmail(value: unknown): { value: string } | { error: FieldIssue } {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: issue("required", "Enter your email address.") };
  }
  const email = value.trim().toLowerCase();
  if (email.length > EMAIL_MAX) {
    return { error: issue("too_long", "Enter a shorter email address.") };
  }
  if (!EMAIL_PATTERN.test(email) || FORBIDDEN_CHARS.test(email)) {
    return { error: issue("invalid", "Enter a valid email address.") };
  }
  return { value: email };
}

function validateTexasResident(value: unknown): { value: boolean } | { error: FieldIssue } {
  if (typeof value !== "boolean") {
    return { error: issue("invalid", "Say whether you live in Texas.") };
  }
  return { value };
}

/**
 * Shared signup rules. The browser calls this before submit, and the Worker
 * calls it again on the JSON body. Messages are static and never include the
 * submitted value.
 */
export function validateSignup(input: unknown): SignupResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: {},
      form: issue(
        "invalid_body",
        "Send your name, mailing address, email, and Texas residency.",
      ),
    };
  }

  const errors: SignupIssues = {};
  const name = validateFullName(input.fullName);
  const address = validateMailingAddress(input.mailingAddress);
  const email = validateEmail(input.email);
  const texasResident = validateTexasResident(input.texasResident);

  if ("error" in name) errors.fullName = name.error;
  if ("error" in address) errors.mailingAddress = address.error;
  if ("error" in email) errors.email = email.error;
  if ("error" in texasResident) errors.texasResident = texasResident.error;

  if (
    "error" in name ||
    "error" in address ||
    "error" in email ||
    "error" in texasResident
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      fullName: name.value,
      mailingAddress: address.value,
      email: email.value,
      texasResident: texasResident.value,
      // Derived here so a client cannot swap in another law label.
      jurisdiction: JURISDICTION_TDPSA,
      nonTexasFlag: !texasResident.value,
    },
  };
}

export function readSignupFailure(payload: unknown): Extract<SignupResult, { ok: false }> | null {
  if (!isRecord(payload) || payload.ok !== false || !isRecord(payload.errors)) {
    return null;
  }

  const errors: SignupIssues = {};
  for (const field of SIGNUP_FIELDS) {
    const issueValue = payload.errors[field];
    if (!isRecord(issueValue)) continue;
    if (typeof issueValue.code !== "string" || typeof issueValue.message !== "string") {
      continue;
    }
    errors[field] = { code: issueValue.code, message: issueValue.message };
  }

  let form: FieldIssue | undefined;
  if (isRecord(payload.form) && typeof payload.form.code === "string" && typeof payload.form.message === "string") {
    form = { code: payload.form.code, message: payload.form.message };
  }

  if (Object.keys(errors).length === 0 && !form) {
    return null;
  }

  return form ? { ok: false, errors, form } : { ok: false, errors };
}
