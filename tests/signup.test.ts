import { describe, expect, it } from "vitest";
import { PHONE_FIELD_LABEL, US_STATES, dobRange, validateSignup } from "../shared/signup";

const valid = {
  firstName: "Ada",
  lastName: "Lovelace",
  dob: "1990-01-15",
  addressLine1: "123 Main St",
  city: "Austin",
  state: "TX",
  zip: "78701",
  email: "ada@example.com",
  texasResident: true,
};

describe("validateSignup", () => {
  it("labels the phone field as optional", () => {
    expect(PHONE_FIELD_LABEL).toBe("Phone number (optional)");
  });

  it("lists each US state and the District of Columbia once", () => {
    expect(US_STATES).toHaveLength(51);
    expect(new Set(US_STATES.map((state) => state.code)).size).toBe(51);
    expect(US_STATES.some((state) => state.code === "TX" && state.name === "Texas")).toBe(true);
  });

  it("accepts a Texan and normalizes whitespace, state, and email case", () => {
    const result = validateSignup({
      firstName: "  Ada ",
      middleName: "  Augusta  ",
      lastName: " Lovelace ",
      dob: "1990-01-15",
      addressLine1: "  123 Main St ",
      addressLine2: "  Apt 4 ",
      city: "  Austin ",
      state: " tx ",
      zip: "78701-1234",
      email: "  Ada@Example.com ",
      texasResident: true,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        firstName: "Ada",
        middleName: "Augusta",
        lastName: "Lovelace",
        dob: "1990-01-15",
        addressLine1: "123 Main St",
        addressLine2: "Apt 4",
        city: "Austin",
        state: "TX",
        zip: "78701-1234",
        email: "ada@example.com",
        phone: null,
        texasResident: true,
        jurisdiction: "TDPSA",
        nonTexasFlag: false,
        submitter: "self",
        child: null,
        guardianAttestation: false,
      },
    });
  });

  it("treats a missing, empty, or null middle name and apartment as blank", () => {
    for (const middleName of [undefined, "", null]) {
      for (const addressLine2 of [undefined, "", null]) {
        const result = validateSignup({ ...valid, middleName, addressLine2 });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.middleName).toBeNull();
          expect(result.value.addressLine2).toBeNull();
        }
      }
    }
  });

  it("accepts a non-Texan under TDPSA and marks the non-Texas flag", () => {
    const result = validateSignup({ ...valid, texasResident: false, jurisdiction: "CCPA" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.texasResident).toBe(false);
      expect(result.value.jurisdiction).toBe("TDPSA");
      expect(result.value.nonTexasFlag).toBe(true);
    }
  });

  it("rejects a missing required name or street", () => {
    const result = validateSignup({ ...valid, firstName: "   ", lastName: "", addressLine1: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.firstName?.code).toBe("required");
      expect(result.errors.lastName?.code).toBe("required");
      expect(result.errors.addressLine1?.code).toBe("required");
      expect(result.errors.firstName?.message).not.toContain("Ada");
    }
  });

  it("rejects markup in a name and a street", () => {
    const result = validateSignup({
      ...valid,
      firstName: "Ada <script>",
      addressLine1: "123 Main <b>St</b>",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.firstName?.code).toBe("invalid");
      expect(result.errors.addressLine1?.code).toBe("invalid");
    }
  });

  it("rejects a bad ZIP code and a state that is not a USPS code", () => {
    const result = validateSignup({ ...valid, zip: "7870", state: "Texas" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.zip).toEqual({
        code: "invalid",
        message: "Enter a 5-digit ZIP code, or ZIP+4.",
      });
      expect(result.errors.state).toEqual({
        code: "invalid",
        message: "Choose a US state.",
      });
      expect(result.errors.zip?.message).not.toContain("7870");
      expect(result.errors.state?.message).not.toContain("Texas");
    }
    const unknown = validateSignup({ ...valid, state: "XX" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors.state?.code).toBe("invalid");
  });

  it("rejects an invalid email", () => {
    const result = validateSignup({ ...valid, email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email?.code).toBe("invalid");
      expect(result.errors.email?.message).not.toContain("not-an-email");
    }
  });

  it("rejects a non-boolean residency flag", () => {
    const result = validateSignup({ ...valid, texasResident: "yes" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.texasResident?.code).toBe("invalid");
  });

  it("rejects a non-object body with a form error", () => {
    const result = validateSignup(["nope"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({});
      expect(result.form?.code).toBe("invalid_body");
    }
  });

  it("requires a real date of birth that is not in the future or older than 120 years", () => {
    const { earliest, latest } = dobRange();
    const dayBefore = (() => {
      const [year, month, day] = earliest.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() - 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();
    const dayAfter = (() => {
      const [year, month, day] = latest.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();

    expect(validateSignup({ ...valid, dob: undefined }).ok).toBe(false);
    const missing = validateSignup({ ...valid, dob: "  " });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors.dob).toEqual({ code: "required", message: "Enter your date of birth." });
    }

    for (const dob of ["2024-02-31", "2024-13-01", "1990-1-1", "02/01/1990", "1900-02-29"]) {
      const result = validateSignup({ ...valid, dob });
      expect(result.ok, dob).toBe(false);
      if (!result.ok) expect(result.errors.dob?.code).toBe("invalid");
    }

    const future = validateSignup({ ...valid, dob: dayAfter });
    expect(future.ok).toBe(false);
    if (!future.ok) {
      expect(future.errors.dob).toEqual({
        code: "future",
        message: "Date of birth cannot be in the future.",
      });
    }

    const ancient = validateSignup({ ...valid, dob: dayBefore });
    expect(ancient.ok).toBe(false);
    if (!ancient.ok) {
      expect(ancient.errors.dob).toEqual({
        code: "too_old",
        message: "Date of birth cannot be more than 120 years ago.",
      });
    }

    for (const dob of [earliest, latest, "2000-02-29"]) {
      const result = validateSignup({ ...valid, dob });
      expect(result.ok, dob).toBe(true);
      if (result.ok) expect(result.value.dob).toBe(dob);
    }
  });

  it("accepts a parent submitting for a child under 13 at the same address", () => {
    const { earliest } = dobRange();
    const parentDob = earliest;
    const childDob = dobRange().latest;
    const result = validateSignup({
      ...valid,
      dob: parentDob,
      submitter: "child",
      guardianAttestation: true,
      child: {
        firstName: "Grace",
        middleName: "",
        lastName: "Hopper",
        dob: childDob,
        sameAddress: true,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.submitter).toBe("child");
      expect(result.value.guardianAttestation).toBe(true);
      expect(result.value.child).toEqual({
        firstName: "Grace",
        middleName: null,
        lastName: "Hopper",
        dob: childDob,
        sameAddress: true,
      });
      expect(result.value.child).not.toHaveProperty("addressLine1");
    }
  });

  it("requires a separate child address, an under-13 child, an adult parent, and the attestation", () => {
    const { latest } = dobRange();
    const adult = "1990-01-15";
    const turned13 = (() => {
      const today = new Date();
      const date = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();
    const baseChild = {
      firstName: "Grace",
      lastName: "Hopper",
      dob: latest,
      sameAddress: false,
      addressLine1: "9 Oak St",
      city: "Austin",
      state: "TX",
      zip: "78702",
    };

    const youngParent = validateSignup({
      ...valid,
      dob: latest,
      submitter: "child",
      guardianAttestation: true,
      child: { ...baseChild, sameAddress: true },
    });
    expect(youngParent.ok).toBe(false);
    if (!youngParent.ok) expect(youngParent.errors.dob?.code).toBe("underage");

    const olderChild = validateSignup({
      ...valid,
      dob: adult,
      submitter: "child",
      guardianAttestation: true,
      child: { ...baseChild, dob: turned13, sameAddress: true },
    });
    expect(olderChild.ok).toBe(false);
    if (!olderChild.ok) expect(olderChild.errors.childDob?.message).toBe("The child must be under 13.");

    const futureChild = validateSignup({
      ...valid,
      dob: adult,
      submitter: "child",
      guardianAttestation: true,
      child: {
        ...baseChild,
        dob: (() => {
          const today = new Date();
          today.setDate(today.getDate() + 1);
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, "0");
          const d = String(today.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        })(),
        sameAddress: true,
      },
    });
    expect(futureChild.ok).toBe(false);
    if (!futureChild.ok) expect(futureChild.errors.childDob?.code).toBe("future");

    const missingAttestation = validateSignup({
      ...valid,
      dob: adult,
      submitter: "child",
      child: { ...baseChild, sameAddress: true },
    });
    expect(missingAttestation.ok).toBe(false);
    if (!missingAttestation.ok) expect(missingAttestation.errors.guardianAttestation?.code).toBe("required");

    const missingAddress = validateSignup({
      ...valid,
      dob: adult,
      submitter: "child",
      guardianAttestation: true,
      child: { firstName: "Grace", lastName: "Hopper", dob: latest, sameAddress: false },
    });
    expect(missingAddress.ok).toBe(false);
    if (!missingAddress.ok) {
      expect(missingAddress.errors.childAddressLine1?.code).toBe("required");
      expect(missingAddress.errors.childCity?.code).toBe("required");
      expect(missingAddress.errors.childZip?.code).toBe("required");
    }

    const differentAddress = validateSignup({
      ...valid,
      dob: adult,
      submitter: "child",
      guardianAttestation: true,
      child: baseChild,
    });
    expect(differentAddress.ok).toBe(true);
    if (differentAddress.ok && differentAddress.value.child && differentAddress.value.child.sameAddress === false) {
      expect(differentAddress.value.child.addressLine1).toBe("9 Oak St");
      expect(differentAddress.value.child.state).toBe("TX");
    }

    const selfWithChild = validateSignup({
      ...valid,
      submitter: "self",
      guardianAttestation: true,
      child: { ...baseChild, sameAddress: true },
    });
    expect(selfWithChild.ok).toBe(false);
    if (!selfWithChild.ok) expect(selfWithChild.errors.submitter?.code).toBe("unexpected");
  });

  it("ignores extra keys in the stored value", () => {
    const result = validateSignup({ ...valid, ssn: "123-45-6789" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        firstName: "Ada",
        middleName: null,
        lastName: "Lovelace",
        dob: "1990-01-15",
        addressLine1: "123 Main St",
        addressLine2: null,
        city: "Austin",
        state: "TX",
        zip: "78701",
        email: "ada@example.com",
        phone: null,
        texasResident: true,
        jurisdiction: "TDPSA",
        nonTexasFlag: false,
        submitter: "self",
        child: null,
        guardianAttestation: false,
      });
      expect(JSON.stringify(result.value)).not.toContain("123-45-6789");
    }
  });

  it("treats a missing, empty, or null phone as no phone and normalizes a US number", () => {
    for (const phone of [undefined, "", null]) {
      const result = validateSignup({ ...valid, phone });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.phone).toBeNull();
    }
    const formatted = validateSignup({ ...valid, phone: "(512) 555-0100" });
    expect(formatted.ok).toBe(true);
    if (formatted.ok) expect(formatted.value.phone).toBe("+15125550100");
    const bad = validateSignup({ ...valid, phone: "123" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.phone).toEqual({
        code: "invalid",
        message: "Enter a valid US phone number.",
      });
      expect(bad.errors.phone?.message).not.toContain("123");
    }
  });
});
