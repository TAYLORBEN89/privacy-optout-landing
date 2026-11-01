import { describe, expect, it, vi } from "vitest";
import { submitSignup } from "../src/submitSignup";

const valid = {
  firstName: "  Ada ",
  middleName: "  ",
  lastName: " Lovelace ",
  dob: "1990-01-15",
  addressLine1: "  123 Main St ",
  addressLine2: "",
  city: " Austin ",
  state: "tx",
  zip: "78701",
  email: "  Ada@Example.com ",
  phone: "",
  texasResident: false,
};

const normalized = {
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
  texasResident: false,
  jurisdiction: "TDPSA",
  nonTexasFlag: true,
};

describe("submitSignup", () => {
  it("stops on client errors and does not call the server", async () => {
    const fetchImpl = vi.fn();
    const result = await submitSignup({ ...valid, email: "nope" }, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email?.code).toBe("invalid");
  });

  it("posts the normalized value and returns success", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ ok: true }));
    const result = await submitSignup(valid, fetchImpl);
    expect(result.ok).toBe(true);
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/api/signup");
    expect(JSON.parse(String(init?.body))).toEqual(normalized);
  });

  it("posts an E.164 phone and keeps a null phone when the field is empty", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ ok: true }));
    await submitSignup({ ...valid, phone: "512.555.0100" }, fetchImpl);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).phone).toBe("+15125550100");
    const empty = vi.fn<typeof fetch>(async () => Response.json({ ok: true }));
    await submitSignup({ ...valid, phone: "   " }, empty);
    expect(JSON.parse(String(empty.mock.calls[0]?.[1]?.body)).phone).toBeNull();
  });

  it("surfaces server field errors", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          ok: false,
          errors: {
            zip: { code: "invalid", message: "Enter a 5-digit ZIP code, or ZIP+4." },
          },
        },
        { status: 400 },
      ),
    );
    const result = await submitSignup(valid, fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.zip?.code).toBe("invalid");
  });

  it("returns a form error when the network fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await submitSignup(valid, fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.form?.code).toBe("unavailable");
  });
});
