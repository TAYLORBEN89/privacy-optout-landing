import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PHONE_FIELD_LABEL,
  US_STATES,
  type FieldIssue,
  type SignupField,
  type SignupIssues,
} from "../shared/signup";
import { storageNotice, submissionConfirmation } from "../worker/storage";
import { fieldErrorEvents, track } from "./analytics";
import { AppLink } from "./router";
import { submitSignup } from "./submitSignup";

const EMPTY_ERRORS: SignupIssues = {};
const FOCUS_ORDER = [
  "firstName",
  "middleName",
  "lastName",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "email",
  "phone",
  "texasResident",
] as const satisfies readonly SignupField[];

export function SignupForm() {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("TX");
  const [zip, setZip] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [texasResident, setTexasResident] = useState(false);
  const [errors, setErrors] = useState<SignupIssues>(EMPTY_ERRORS);
  const [formError, setFormError] = useState<FieldIssue | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const focusTarget = useRef<"status" | "form" | SignupField | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  useEffect(() => {
    if (focusToken === 0) return;
    const target = focusTarget.current;
    if (target === "status") statusRef.current?.focus();
    else if (target === "form") formErrorRef.current?.focus();
    else if (target) document.getElementById(target)?.focus();
  }, [focusToken]);

  function markStarted() {
    if (started.current) return;
    started.current = true;
    track({ event: "form_started" });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSuccess(false);

    const result = await submitSignup({
      firstName,
      middleName,
      lastName,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      email,
      phone,
      texasResident,
    });

    setSubmitting(false);

    if (result.ok) {
      setErrors(EMPTY_ERRORS);
      setFormError(null);
      setSuccess(true);
      track({ event: "submitted" });
      focusTarget.current = "status";
      setFocusToken((token) => token + 1);
      return;
    }

    setSuccess(false);
    setErrors(result.errors);
    setFormError(result.form ?? null);
    for (const analyticsEvent of fieldErrorEvents(result.errors)) {
      track(analyticsEvent);
    }

    const firstInvalid = FOCUS_ORDER.find((field) => result.errors[field]);
    focusTarget.current = firstInvalid ?? "form";
    setFocusToken((token) => token + 1);
  }

  return (
    <form
      id="opt-out"
      className="form-card"
      noValidate
      aria-busy={submitting}
      onFocus={markStarted}
      onSubmit={onSubmit}
    >
      <h2 id="form-heading">Send your request</h2>
      {success ? (
        <p className="status" role="status" tabIndex={-1} ref={statusRef}>
          {submissionConfirmation()} {storageNotice()}
        </p>
      ) : null}
      {formError ? (
        <p className="error form-error" id="form-error" role="alert" tabIndex={-1} ref={formErrorRef}>
          {formError.message}
        </p>
      ) : null}

      <div className="form-grid">
      <TextControl
        id="firstName"
        className="field-first"
        label="First name"
        required
        autoComplete="given-name"
        value={firstName}
        error={errors.firstName}
        onChange={setFirstName}
        onStart={markStarted}
      />
      <TextControl
        id="middleName"
        className="field-middle"
        label="Middle name"
        optional
        autoComplete="additional-name"
        value={middleName}
        error={errors.middleName}
        onChange={setMiddleName}
        onStart={markStarted}
      />
      <TextControl
        id="lastName"
        className="field-last"
        label="Last name"
        required
        autoComplete="family-name"
        value={lastName}
        error={errors.lastName}
        onChange={setLastName}
        onStart={markStarted}
      />
      <TextControl
        id="addressLine1"
        className="field-street"
        label="Street address"
        required
        autoComplete="address-line1"
        value={addressLine1}
        error={errors.addressLine1}
        onChange={setAddressLine1}
        onStart={markStarted}
      />
      <TextControl
        id="addressLine2"
        className="field-apt"
        label="Apt, suite, unit"
        optional
        autoComplete="address-line2"
        value={addressLine2}
        error={errors.addressLine2}
        onChange={setAddressLine2}
        onStart={markStarted}
      />
      <TextControl
        id="city"
        className="field-city"
        label="City"
        required
        autoComplete="address-level2"
        value={city}
        error={errors.city}
        onChange={setCity}
        onStart={markStarted}
      />
        <div className="field field-state">
          <label htmlFor="state">
            State <span className="req">(required)</span>
          </label>
          <select
            id="state"
            className="control"
            name="state"
            autoComplete="address-level1"
            value={state}
            aria-required="true"
            aria-invalid={errors.state ? true : undefined}
            aria-describedby={errors.state ? "state-error" : undefined}
            onChange={(event) => {
              markStarted();
              setState(event.target.value);
            }}
          >
            {US_STATES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
          {errors.state ? (
            <p className="error" id="state-error" role="alert">
              {errors.state.message}
            </p>
          ) : null}
        </div>
        <TextControl
          id="zip"
          className="field-zip"
          label="ZIP code"
          required
          autoComplete="postal-code"
          inputMode="numeric"
          value={zip}
          error={errors.zip}
          onChange={setZip}
          onStart={markStarted}
        />
      <TextControl
        id="email"
        className="field-email"
        label="Email"
        required
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        error={errors.email}
        onChange={setEmail}
        onStart={markStarted}
      />
      <TextControl
        id="phone"
        className="field-phone"
        label={PHONE_FIELD_LABEL}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        value={phone}
        error={errors.phone}
        onChange={setPhone}
        onStart={markStarted}
      />

      <div className="field check field-check">
        <input
          id="texasResident"
          name="texasResident"
          type="checkbox"
          checked={texasResident}
          aria-invalid={errors.texasResident ? true : undefined}
          aria-describedby={errors.texasResident ? "texasResident-error texasResident-hint" : "texasResident-hint"}
          onChange={(event) => {
            markStarted();
            setTexasResident(event.target.checked);
          }}
        />
        <div>
          <label htmlFor="texasResident">I live in Texas</label>
          <p className="hint" id="texasResident-hint">Texas residents are covered by the Texas Data Privacy and Security Act (TDPSA). <AppLink href="/tdpsa">See your rights</AppLink>.</p>
          {errors.texasResident ? (
            <p className="error" id="texasResident-error" role="alert">
              {errors.texasResident.message}
            </p>
          ) : null}
        </div>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit opt-out request"}
      </button>
      </div>
      <p className="fine-print">{storageNotice()}</p>
    </form>
  );
}

function TextControl({
  id,
  label,
  className,
  required = false,
  optional = false,
  type = "text",
  autoComplete,
  inputMode,
  value,
  error,
  onChange,
  onStart,
}: {
  id: SignupField;
  label: string;
  className?: string;
  required?: boolean;
  optional?: boolean;
  type?: "text" | "email" | "tel";
  autoComplete: string;
  inputMode?: "numeric" | "email" | "tel";
  value: string;
  error?: FieldIssue;
  onChange: (value: string) => void;
  onStart: () => void;
}) {
  return (
    <div className={className ? `field ${className}` : "field"}>
      <label htmlFor={id}>
        {label} {required ? <span className="req">(required)</span> : null}
        {optional ? <span className="req">(optional)</span> : null}
      </label>
      <input
        id={id}
        className="control"
        name={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={type === "email" ? false : undefined}
        value={value}
        aria-required={required ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          onStart();
          onChange(event.target.value);
        }}
      />
      {error ? (
        <p className="error" id={`${id}-error`} role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
