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
  "dob",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "email",
  "phone",
  "texasResident",
  "childFirstName",
  "childMiddleName",
  "childLastName",
  "childDob",
  "childAddressLine1",
  "childAddressLine2",
  "childCity",
  "childState",
  "childZip",
  "guardianAttestation",
] as const satisfies readonly SignupField[];

export function SignupForm() {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("TX");
  const [zip, setZip] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [texasResident, setTexasResident] = useState(false);
  const [submitter, setSubmitter] = useState<"self" | "child">("self");
  const [childFirstName, setChildFirstName] = useState("");
  const [childMiddleName, setChildMiddleName] = useState("");
  const [childLastName, setChildLastName] = useState("");
  const [childDob, setChildDob] = useState("");
  const [sameAddress, setSameAddress] = useState(true);
  const [childAddressLine1, setChildAddressLine1] = useState("");
  const [childAddressLine2, setChildAddressLine2] = useState("");
  const [childCity, setChildCity] = useState("");
  const [childState, setChildState] = useState("TX");
  const [childZip, setChildZip] = useState("");
  const [guardianAttestation, setGuardianAttestation] = useState(false);
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
      dob,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      email,
      phone,
      texasResident,
      submitter,
      guardianAttestation: submitter === "child" ? guardianAttestation : false,
      child:
        submitter === "child"
          ? {
              firstName: childFirstName,
              middleName: childMiddleName,
              lastName: childLastName,
              dob: childDob,
              sameAddress,
              ...(sameAddress
                ? {}
                : {
                    addressLine1: childAddressLine1,
                    addressLine2: childAddressLine2,
                    city: childCity,
                    state: childState,
                    zip: childZip,
                  }),
            }
          : null,
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
      <fieldset className="submitter-field">
        <legend>I&apos;m submitting for</legend>
        <div className="segmented">
          <label>
            <input
              type="radio"
              name="submitter"
              value="self"
              checked={submitter === "self"}
              onChange={() => {
                markStarted();
                setSubmitter("self");
              }}
            />
            <span>Myself</span>
          </label>
          <label>
            <input
              type="radio"
              name="submitter"
              value="child"
              checked={submitter === "child"}
              onChange={() => {
                markStarted();
                setSubmitter("child");
              }}
            />
            <span>My child</span>
          </label>
        </div>
      </fieldset>
      <h2 id="form-heading">{submitter === "child" ? "Your details (parent or guardian)" : "Send your request"}</h2>
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
        id="dob"
        className="field-dob"
        label="Date of birth"
        required
        type="date"
        autoComplete="bday"
        value={dob}
        error={errors.dob}
        onChange={setDob}
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

      {submitter === "child" ? (
        <fieldset className="child-details">
          <legend>Child&apos;s details</legend>
          <TextControl
            id="childFirstName"
            className="field-first"
            label="First name"
            required
            autoComplete="off"
            value={childFirstName}
            error={errors.childFirstName}
            onChange={setChildFirstName}
            onStart={markStarted}
          />
          <TextControl
            id="childMiddleName"
            className="field-middle"
            label="Middle name"
            optional
            autoComplete="off"
            value={childMiddleName}
            error={errors.childMiddleName}
            onChange={setChildMiddleName}
            onStart={markStarted}
          />
          <TextControl
            id="childLastName"
            className="field-last"
            label="Last name"
            required
            autoComplete="off"
            value={childLastName}
            error={errors.childLastName}
            onChange={setChildLastName}
            onStart={markStarted}
          />
          <TextControl
            id="childDob"
            className="field-dob"
            label="Date of birth"
            required
            type="date"
            autoComplete="off"
            value={childDob}
            error={errors.childDob}
            onChange={setChildDob}
            onStart={markStarted}
          />
          <div className="field check field-check">
            <input
              id="childSameAddress"
              name="childSameAddress"
              type="checkbox"
              checked={sameAddress}
              aria-invalid={errors.childSameAddress ? true : undefined}
              aria-describedby={errors.childSameAddress ? "childSameAddress-error" : undefined}
              onChange={(event) => {
                markStarted();
                setSameAddress(event.target.checked);
              }}
            />
            <div>
              <label htmlFor="childSameAddress">My child lives at the address above</label>
              {errors.childSameAddress ? (
                <p className="error" id="childSameAddress-error" role="alert">
                  {errors.childSameAddress.message}
                </p>
              ) : null}
            </div>
          </div>
          {sameAddress ? null : (
            <>
              <TextControl
                id="childAddressLine1"
                className="field-street"
                label="Street address"
                required
                autoComplete="off"
                value={childAddressLine1}
                error={errors.childAddressLine1}
                onChange={setChildAddressLine1}
                onStart={markStarted}
              />
              <TextControl
                id="childAddressLine2"
                className="field-apt"
                label="Apt, suite, unit"
                optional
                autoComplete="off"
                value={childAddressLine2}
                error={errors.childAddressLine2}
                onChange={setChildAddressLine2}
                onStart={markStarted}
              />
              <TextControl
                id="childCity"
                className="field-city"
                label="City"
                required
                autoComplete="off"
                value={childCity}
                error={errors.childCity}
                onChange={setChildCity}
                onStart={markStarted}
              />
              <div className="field field-state">
                <label htmlFor="childState">
                  State <span className="req">(required)</span>
                </label>
                <select
                  id="childState"
                  className="control"
                  name="childState"
                  value={childState}
                  aria-required="true"
                  aria-invalid={errors.childState ? true : undefined}
                  aria-describedby={errors.childState ? "childState-error" : undefined}
                  onChange={(event) => {
                    markStarted();
                    setChildState(event.target.value);
                  }}
                >
                  {US_STATES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {errors.childState ? (
                  <p className="error" id="childState-error" role="alert">
                    {errors.childState.message}
                  </p>
                ) : null}
              </div>
              <TextControl
                id="childZip"
                className="field-zip"
                label="ZIP code"
                required
                autoComplete="off"
                inputMode="numeric"
                value={childZip}
                error={errors.childZip}
                onChange={setChildZip}
                onStart={markStarted}
              />
            </>
          )}
          <div className="field check field-check">
            <input
              id="guardianAttestation"
              name="guardianAttestation"
              type="checkbox"
              checked={guardianAttestation}
              aria-required="true"
              aria-invalid={errors.guardianAttestation ? true : undefined}
              aria-describedby={errors.guardianAttestation ? "guardianAttestation-error" : undefined}
              onChange={(event) => {
                markStarted();
                setGuardianAttestation(event.target.checked);
              }}
            />
            <div>
              <label htmlFor="guardianAttestation">
                I am this child&apos;s parent or legal guardian and am authorized to make this request on their behalf.
              </label>
              {errors.guardianAttestation ? (
                <p className="error" id="guardianAttestation-error" role="alert">
                  {errors.guardianAttestation.message}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>
      ) : null}

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
  type?: "text" | "email" | "tel" | "date";
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
