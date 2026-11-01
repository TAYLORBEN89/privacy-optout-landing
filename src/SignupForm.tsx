import { useEffect, useRef, useState, type FormEvent } from "react";
import { PHONE_FIELD_HINT, PHONE_FIELD_LABEL, type FieldIssue, type SignupIssues } from "../shared/signup";
import { storageNotice, submissionConfirmation } from "../worker/storage";
import { fieldErrorEvents, track } from "./analytics";
import { submitSignup } from "./submitSignup";

const EMPTY_ERRORS: SignupIssues = {};

export function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");
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
  const focusTarget = useRef<"status" | "form" | "fullName" | "mailingAddress" | "email" | "phone" | "texasResident" | null>(
    null,
  );
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

    const trimmedPhone = phone.trim();
    const result = await submitSignup({
      fullName,
      mailingAddress,
      email,
      texasResident,
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
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

    const firstInvalid = (["fullName", "mailingAddress", "email", "phone", "texasResident"] as const).find(
      (field) => result.errors[field],
    );
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

      <div className="field">
        <label htmlFor="fullName">
          Full name <span className="req">(required)</span>
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          value={fullName}
          aria-required="true"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? "fullName-error fullName-hint" : "fullName-hint"}
          onChange={(event) => {
            markStarted();
            setFullName(event.target.value);
          }}
        />
        <p className="hint" id="fullName-hint">
          First and last name.
        </p>
        {errors.fullName ? (
          <p className="error" id="fullName-error" role="alert">
            {errors.fullName.message}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="mailingAddress">
          Mailing address <span className="req">(required)</span>
        </label>
        <textarea
          id="mailingAddress"
          name="mailingAddress"
          autoComplete="street-address"
          value={mailingAddress}
          aria-required="true"
          aria-invalid={errors.mailingAddress ? true : undefined}
          aria-describedby={
            errors.mailingAddress ? "mailingAddress-error mailingAddress-hint" : "mailingAddress-hint"
          }
          onChange={(event) => {
            markStarted();
            setMailingAddress(event.target.value);
          }}
        />
        <p className="hint" id="mailingAddress-hint">
          Street, city, state, and ZIP code. Most broker opt-out forms require a physical address.
        </p>
        {errors.mailingAddress ? (
          <p className="error" id="mailingAddress-error" role="alert">
            {errors.mailingAddress.message}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="email">
          Email <span className="req">(required)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          value={email}
          aria-required="true"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          onChange={(event) => {
            markStarted();
            setEmail(event.target.value);
          }}
        />
        {errors.email ? (
          <p className="error" id="email-error" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="phone">{PHONE_FIELD_LABEL}</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? "phone-error phone-hint" : "phone-hint"}
          onChange={(event) => {
            markStarted();
            setPhone(event.target.value);
          }}
        />
        <p className="hint" id="phone-hint">
          {PHONE_FIELD_HINT}
        </p>
        {errors.phone ? (
          <p className="error" id="phone-error" role="alert">
            {errors.phone.message}
          </p>
        ) : null}
      </div>

      <div className="field check">
        <input
          id="texasResident"
          name="texasResident"
          type="checkbox"
          checked={texasResident}
          aria-invalid={errors.texasResident ? true : undefined}
          aria-describedby={
            errors.texasResident ? "texasResident-error texasResident-hint" : "texasResident-hint"
          }
          onChange={(event) => {
            markStarted();
            setTexasResident(event.target.checked);
          }}
        />
        <div>
          <label htmlFor="texasResident">I live in Texas</label>
          <p className="hint" id="texasResident-hint">
            Check this if you live in Texas. A checked box means the Texas Data Privacy and
            Security Act (TDPSA). Leave it unchecked if you live somewhere else. You can still
            submit. An unchecked box still uses TDPSA for now and is marked non-Texas.
          </p>
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
      <p className="fine-print">{storageNotice()}</p>
    </form>
  );
}
