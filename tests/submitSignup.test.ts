import { describe, expect, it, vi } from "vitest";
import { submitSignup } from "../src/submitSignup";

const valid = {
  fullName: "  Ada   Lovelace ",
  mailingAddress: "  123 Main St, Austin, TX 78701 ",
  email: "  Ada@Example.com ",
  texasResident: false,
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
    expect(JSON.parse(String(init?.body))).toEqual({
      fullName: "Ada Lovelace",
      mailingAddress: "123 Main St, Austin, TX 78701",
      email: "ada@example.com",
      texasResident: false,
    });
  });

  it("surfaces server field errors", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          ok: false,
          errors: {
            fullName: { code: "incomplete", message: "Enter a first and last name." },
          },
        },
        { status: 400 },
      ),
    );
    const result = await submitSignup(valid, fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.fullName?.code).toBe("incomplete");
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
