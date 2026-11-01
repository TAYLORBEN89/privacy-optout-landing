// COPIED FROM: github.com/TAYLORBEN89/privacy-optout-landing, branch cursor/privacy-optout-landing-6b72,
// file shared/signup.ts (commit a4231243148a2353ca78acde521beeeab62cd6a6).
// Optional phone is a US number normalized to E.164. PHONE_FIELD_LABEL is the only phone copy exported for the form.
// KEEP IN SYNC: the landing page and this Worker must apply the same signup validation rules. If you change
// one copy, change the other in the same release.
export const SIGNUP_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "dob",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "email",
  "phone",
  "texasResident",
  "submitter",
  "guardianAttestation",
  "childFirstName",
  "childMiddleName",
  "childLastName",
  "childDob",
  "childSameAddress",
  "childAddressLine1",
  "childAddressLine2",
  "childCity",
  "childState",
  "childZip",
] as const;

/** USPS abbreviations for the 50 states and the District of Columbia. */
export const US_STATES: readonly { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const US_STATE_CODES = new Set(US_STATES.map((state) => state.code));

/** UI copy for the optional phone input on the signup / opt-out form. */
export const PHONE_FIELD_LABEL = "Phone number (optional)";

export type SignupField = (typeof SIGNUP_FIELDS)[number];

/** Law label applied to every accepted signup until more states are supported. */
export const JURISDICTION_TDPSA = "TDPSA" as const;

export type Jurisdiction = typeof JURISDICTION_TDPSA;

export interface SignupInput {
  firstName: string;
  /** Optional. Null when the field is left blank. */
  middleName: string | null;
  lastName: string;
  /** Calendar date, YYYY-MM-DD. Required. No minimum age. */
  dob: string;
  addressLine1: string;
  /** Optional. Null when the field is left blank. */
  addressLine2: string | null;
  city: string;
  /** USPS abbreviation, for example TX. */
  state: string;
  zip: string;
  email: string;
  /** Optional. E.164 (+1XXXXXXXXXX) when given, otherwise null. */
  phone: string | null;
  texasResident: boolean;
  /** Always TDPSA for now, including when the Texas box is unchecked. */
  jurisdiction: Jurisdiction;
  /** True when the person said they do not live in Texas. */
  nonTexasFlag: boolean;
  submitter: "self" | "child";
  /** Present only when submitter is "child". */
  child: ChildSignup | null;
  /** True only when a parent or guardian attests for a child. */
  guardianAttestation: boolean;
}

export interface ChildSignup {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dob: string;
  sameAddress: boolean;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  zip?: string;
}

export interface FieldIssue {
  code: string;
  message: string;
}

export type SignupIssues = Partial<Record<SignupField, FieldIssue>>;

export type SignupResult =
  | { ok: true; value: SignupInput }
  | { ok: false; errors: SignupIssues; form?: FieldIssue };

const NAME_MAX = 60;
const STREET_MAX = 100;
const LINE2_MAX = 50;
const CITY_MAX = 60;
const EMAIL_MAX = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F<>]/;
const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;
const STREET_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s.,'#/&-]*$/u;
const CITY_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;

function issue(code: string, message: string): FieldIssue {
  return { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function validateNamePart(
  value: unknown,
  field: "first" | "middle" | "last",
): { value: string | null } | { error: FieldIssue } {
  const required = field !== "middle";
  const label = field === "first" ? "first name" : field === "last" ? "last name" : "middle name";
  if (isBlank(value)) {
    return required ? { error: issue("required", `Enter your ${label}.`) } : { value: null };
  }
  if (typeof value !== "string") return { error: issue("invalid", `Use letters in your ${label}.`) };
  const name = normalizeSpaces(value);
  if (name.length > NAME_MAX) {
    return { error: issue("too_long", `Enter a shorter ${label} (${NAME_MAX} characters or fewer).`) };
  }
  if (FORBIDDEN_CHARS.test(name) || !NAME_PATTERN.test(name)) {
    return { error: issue("invalid", `Use letters in your ${label}.`) };
  }
  return { value: name };
}

function validateStreet(value: unknown): { value: string } | { error: FieldIssue } {
  if (isBlank(value)) return { error: issue("required", "Enter your street address.") };
  if (typeof value !== "string") return { error: issue("invalid", "Enter a street address.") };
  const street = normalizeSpaces(value);
  if (street.length > STREET_MAX) {
    return { error: issue("too_long", `Enter a shorter street address (${STREET_MAX} characters or fewer).`) };
  }
  if (FORBIDDEN_CHARS.test(street) || !STREET_PATTERN.test(street)) {
    return { error: issue("invalid", "Remove characters like < or > from the street address.") };
  }
  return { value: street };
}

function validateLine2(value: unknown): { value: string | null } | { error: FieldIssue } {
  if (isBlank(value)) return { value: null };
  if (typeof value !== "string") return { error: issue("invalid", "Enter an apartment, suite, or unit.") };
  const line = normalizeSpaces(value);
  if (line.length > LINE2_MAX) {
    return { error: issue("too_long", `Enter a shorter apartment, suite, or unit (${LINE2_MAX} characters or fewer).`) };
  }
  if (FORBIDDEN_CHARS.test(line) || !STREET_PATTERN.test(line)) {
    return { error: issue("invalid", "Remove characters like < or > from the apartment, suite, or unit.") };
  }
  return { value: line };
}

function validateCity(value: unknown): { value: string } | { error: FieldIssue } {
  if (isBlank(value)) return { error: issue("required", "Enter your city.") };
  if (typeof value !== "string") return { error: issue("invalid", "Enter a city.") };
  const city = normalizeSpaces(value);
  if (city.length > CITY_MAX) {
    return { error: issue("too_long", `Enter a shorter city (${CITY_MAX} characters or fewer).`) };
  }
  if (FORBIDDEN_CHARS.test(city) || !CITY_PATTERN.test(city)) {
    return { error: issue("invalid", "Use letters in the city name.") };
  }
  return { value: city };
}

function validateState(value: unknown): { value: string } | { error: FieldIssue } {
  if (isBlank(value)) return { error: issue("required", "Choose your state.") };
  if (typeof value !== "string") return { error: issue("invalid", "Choose a US state.") };
  const state = value.trim().toUpperCase();
  if (!US_STATE_CODES.has(state)) return { error: issue("invalid", "Choose a US state.") };
  return { value: state };
}

function validateZip(value: unknown): { value: string } | { error: FieldIssue } {
  if (isBlank(value)) return { error: issue("required", "Enter your ZIP code.") };
  if (typeof value !== "string") return { error: issue("invalid", "Enter a 5-digit ZIP code, or ZIP+4.") };
  const zip = value.trim();
  if (!ZIP_PATTERN.test(zip)) return { error: issue("invalid", "Enter a 5-digit ZIP code, or ZIP+4.") };
  return { value: zip };
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

/**
 * Optional US phone. Accepts common formats such as (512) 555-0100, 512-555-0100, 512.555.0100,
 * +1 512 555 0100, 1-512-555-0100. Normalizes to E.164. Rejects NANP area codes or exchanges that
 * start with 0 or 1 and wrong lengths. Empty / missing is allowed.
 */
export function validatePhone(value: unknown): { value: string | null } | { error: FieldIssue } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { error: issue("invalid", "Enter a valid US phone number.") };
  const raw = value.trim();
  if (raw === "") return { value: null };
  if (raw.length > 32 || !/^\+?[\d\s().-]+$/.test(raw)) {
    return { error: issue("invalid", "Enter a valid US phone number.") };
  }
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && !digits.startsWith("1")) {
    return { error: issue("invalid", "Enter a valid US phone number.") };
  }
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    return { error: issue("invalid", "Enter a valid US phone number.") };
  }
  return { value: `+1${digits}` };
}

const DOB_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function calendarIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Latest allowed birth date is today. Earliest is exactly 120 years before today. */
export function dobRange(now = new Date()): { earliest: string; latest: string } {
  const earliest = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
  return { earliest: calendarIso(earliest), latest: calendarIso(now) };
}

function validateDob(value: unknown, now = new Date()): { value: string } | { error: FieldIssue } {
  if (isBlank(value)) return { error: issue("required", "Enter your date of birth.") };
  if (typeof value !== "string") return { error: issue("invalid", "Enter a real date of birth.") };
  const dob = value.trim();
  const match = DOB_PATTERN.exec(dob);
  if (!match) return { error: issue("invalid", "Enter a real date of birth.") };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const real =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  if (!real) return { error: issue("invalid", "Enter a real date of birth.") };
  const { earliest, latest } = dobRange(now);
  if (dob > latest) return { error: issue("future", "Date of birth cannot be in the future.") };
  if (dob < earliest) return { error: issue("too_old", "Date of birth cannot be more than 120 years ago.") };
  return { value: dob };
}

function ageReached(dob: string, years: number, now = new Date()): boolean {
  const threshold = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  return dob <= calendarIso(threshold);
}

function childNameError(result: { error: FieldIssue }, field: "first" | "middle" | "last"): FieldIssue {
  const label = field === "first" ? "first name" : field === "last" ? "last name" : "middle name";
  if (result.error.code === "required") return issue("required", `Enter the child's ${label}.`);
  if (result.error.code === "too_long") {
    return issue("too_long", `Enter a shorter ${label} for the child (${NAME_MAX} characters or fewer).`);
  }
  return issue("invalid", `Use letters in the child's ${label}.`);
}

function validateChild(child: unknown, now: Date, errors: SignupIssues): ChildSignup | null {
  if (!isRecord(child)) {
    errors.childFirstName = issue("required", "Enter the child's first name.");
    errors.childLastName = issue("required", "Enter the child's last name.");
    errors.childDob = issue("required", "Enter the child's date of birth.");
    return null;
  }
  const firstName = validateNamePart(child.firstName, "first");
  const middleName = validateNamePart(child.middleName, "middle");
  const lastName = validateNamePart(child.lastName, "last");
  if ("error" in firstName) errors.childFirstName = childNameError(firstName, "first");
  if ("error" in middleName) errors.childMiddleName = childNameError(middleName, "middle");
  if ("error" in lastName) errors.childLastName = childNameError(lastName, "last");

  let childDob: string | null = null;
  if (isBlank(child.dob)) {
    errors.childDob = issue("required", "Enter the child's date of birth.");
  } else if (typeof child.dob !== "string") {
    errors.childDob = issue("invalid", "Enter a real date of birth for the child.");
  } else {
    const parsed = validateDob(child.dob, now);
    if ("error" in parsed) {
      if (parsed.error.code === "future") {
        errors.childDob = issue("future", "The child's date of birth cannot be in the future.");
      } else if (parsed.error.code === "too_old" || parsed.error.code === "future") {
        errors.childDob = issue("underage", "The child must be under 13.");
      } else if (parsed.error.code === "required") {
        errors.childDob = issue("required", "Enter the child's date of birth.");
      } else {
        errors.childDob = issue("invalid", "Enter a real date of birth for the child.");
      }
    } else if (ageReached(parsed.value, 13, now)) {
      errors.childDob = issue("underage", "The child must be under 13.");
    } else {
      childDob = parsed.value;
    }
  }

  if (typeof child.sameAddress !== "boolean") {
    errors.childSameAddress = issue("invalid", "Say whether your child lives at the address above.");
    return null;
  }
  if (child.sameAddress) {
    const stray = ["addressLine1", "addressLine2", "city", "state", "zip"].some((key) => !isBlank(child[key]));
    if (stray) {
      errors.childSameAddress = issue(
        "unexpected",
        "Remove the child's address when the child lives at the address above.",
      );
    }
    if ("error" in firstName || "error" in middleName || "error" in lastName || !childDob || errors.childSameAddress) {
      return null;
    }
    return {
      firstName: firstName.value as string,
      middleName: middleName.value,
      lastName: lastName.value as string,
      dob: childDob,
      sameAddress: true,
    };
  }

  const street = validateStreet(child.addressLine1);
  const line2 = validateLine2(child.addressLine2);
  const city = validateCity(child.city);
  const state = validateState(child.state);
  const zip = validateZip(child.zip);
  if ("error" in street) errors.childAddressLine1 = issue(street.error.code, "Enter the child's street address.");
  if ("error" in line2) errors.childAddressLine2 = issue(line2.error.code, "Enter the child's apartment, suite, or unit.");
  if ("error" in city) errors.childCity = issue(city.error.code, "Enter the child's city.");
  if ("error" in state) errors.childState = issue(state.error.code, "Choose the child's state.");
  if ("error" in zip) errors.childZip = issue(zip.error.code, "Enter the child's ZIP code.");
  if (
    "error" in firstName ||
    "error" in middleName ||
    "error" in lastName ||
    !childDob ||
    "error" in street ||
    "error" in line2 ||
    "error" in city ||
    "error" in state ||
    "error" in zip
  ) {
    return null;
  }
  return {
    firstName: firstName.value as string,
    middleName: middleName.value,
    lastName: lastName.value as string,
    dob: childDob,
    sameAddress: false,
    addressLine1: street.value,
    addressLine2: line2.value,
    city: city.value,
    state: state.value,
    zip: zip.value,
  };
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
        "Send your name, date of birth, mailing address, email, and Texas residency.",
      ),
    };
  }

  const errors: SignupIssues = {};
  const firstName = validateNamePart(input.firstName, "first");
  const middleName = validateNamePart(input.middleName, "middle");
  const lastName = validateNamePart(input.lastName, "last");
  const dob = validateDob(input.dob);
  const addressLine1 = validateStreet(input.addressLine1);
  const addressLine2 = validateLine2(input.addressLine2);
  const city = validateCity(input.city);
  const state = validateState(input.state);
  const zip = validateZip(input.zip);
  const email = validateEmail(input.email);
  const phone = validatePhone(input.phone);
  const texasResident = validateTexasResident(input.texasResident);

  if ("error" in firstName) errors.firstName = firstName.error;
  if ("error" in middleName) errors.middleName = middleName.error;
  if ("error" in lastName) errors.lastName = lastName.error;
  if ("error" in dob) errors.dob = dob.error;
  if ("error" in addressLine1) errors.addressLine1 = addressLine1.error;
  if ("error" in addressLine2) errors.addressLine2 = addressLine2.error;
  if ("error" in city) errors.city = city.error;
  if ("error" in state) errors.state = state.error;
  if ("error" in zip) errors.zip = zip.error;
  if ("error" in email) errors.email = email.error;
  if ("error" in phone) errors.phone = phone.error;
  if ("error" in texasResident) errors.texasResident = texasResident.error;

  const submitter =
    input.submitter === undefined ? "self" : input.submitter === "self" || input.submitter === "child" ? input.submitter : null;
  if (!submitter) {
    errors.submitter = issue("invalid", "Choose whether you are submitting for yourself or your child.");
  }
  const childSent = input.child !== undefined && input.child !== null;
  const attested = input.guardianAttestation === true;
  if (submitter === "self" && (childSent || attested)) {
    errors.submitter = issue("unexpected", "Remove the child details when submitting for yourself.");
  }

  let child: ChildSignup | null = null;
  if (submitter === "child") {
    if (!attested) {
      errors.guardianAttestation = issue(
        "required",
        "Confirm you are this child's parent or legal guardian.",
      );
    }
    child = validateChild(input.child, new Date(), errors);
    if (!("error" in dob) && !ageReached(dob.value as string, 18)) {
      errors.dob = issue("underage", "You must be 18 or older to submit for a child.");
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  if (
    "error" in firstName ||
    "error" in middleName ||
    "error" in lastName ||
    "error" in dob ||
    "error" in addressLine1 ||
    "error" in addressLine2 ||
    "error" in city ||
    "error" in state ||
    "error" in zip ||
    "error" in email ||
    "error" in phone ||
    "error" in texasResident
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      firstName: firstName.value as string,
      middleName: middleName.value,
      lastName: lastName.value as string,
      dob: dob.value as string,
      addressLine1: addressLine1.value,
      addressLine2: addressLine2.value,
      city: city.value,
      state: state.value,
      zip: zip.value,
      email: email.value,
      phone: phone.value,
      texasResident: texasResident.value,
      // Derived here so a client cannot swap in another law label.
      jurisdiction: JURISDICTION_TDPSA,
      nonTexasFlag: !texasResident.value,
      submitter: submitter === "child" ? "child" : "self",
      child: submitter === "child" ? child : null,
      guardianAttestation: submitter === "child",
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
