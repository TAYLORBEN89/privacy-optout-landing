import { describe, expect, it } from "vitest";
import { validateSignup } from "../shared/signup";

const valid = {
  fullName: "Ada Lovelace",
  mailingAddress: "123 Main St, Austin, TX 78701",
  email: "ada@example.com",
  texasResident: true,
};

describe("validateSignup", () => {
  it("accepts a Texan and normalizes whitespace and email case", () => {
    const result = validateSignup({
      fullName: "  Ada   Lovelace ",
      mailingAddress: "  123 Main St, Austin, TX 78701  ",
      email: "  Ada@Example.com ",
      texasResident: true,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        fullName: "Ada Lovelace",
        mailingAddress: "123 Main St, Austin, TX 78701",
        email: "ada@example.com",
        texasResident: true,
        jurisdiction: "TDPSA",
        nonTexasFlag: false,
      },
    });
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

  it("rejects a missing or single-word name", () => {
    expect(validateSignup({ ...valid, fullName: "   " }).ok).toBe(false);
    const single = validateSignup({ ...valid, fullName: "Cher" });
    expect(single.ok).toBe(false);
    if (!single.ok) {
      expect(single.errors.fullName).toEqual({
        code: "incomplete",
        message: "Enter a first and last name.",
      });
      expect(single.errors.fullName?.message).not.toContain("Cher");
    }
  });

  it("rejects markup in the name and address", () => {
    const result = validateSignup({
      ...valid,
      fullName: "Ada <script>",
      mailingAddress: "123 Main <b>St</b>, Austin, TX 78701",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fullName?.code).toBe("invalid");
      expect(result.errors.mailingAddress?.code).toBe("invalid");
    }
  });

  it("rejects a short address and an invalid email", () => {
    const result = validateSignup({
      ...valid,
      mailingAddress: "nope",
      email: "not-an-email",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.mailingAddress?.code).toBe("too_short");
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

  it("ignores extra keys in the stored value", () => {
    const result = validateSignup({ ...valid, ssn: "123-45-6789" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        ...valid,
        jurisdiction: "TDPSA",
        nonTexasFlag: false,
      });
      expect(JSON.stringify(result.value)).not.toContain("123-45-6789");
    }
  });
});
