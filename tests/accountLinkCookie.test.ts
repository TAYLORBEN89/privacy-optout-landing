import { describe, expect, it } from "vitest";
import { linkSignupToAccount, sessionCookieOnly } from "../worker/accountLink";

describe("account link forwards only the session cookie", () => {
  it("drops every other cookie", () => {
    expect(sessionCookieOnly("_ga=1; __Host-sid=abc; pref=x")).toBe("__Host-sid=abc");
    expect(sessionCookieOnly("sid=1; other=2")).toBe("");
    expect(sessionCookieOnly("__Host-sid=a;b")).toBe("__Host-sid=a");
  });

  it("uses the Worker origin, not the client origin", async () => {
    let sent: Request | undefined;
    await linkSignupToAccount(
      "https://droptexas.example/api/signup",
      "_ga=1; __Host-sid=abc",
      "csrf-1",
      "https://evil.example",
      { firstName: "A", middleName: null, lastName: "B", addressLine1: "1", addressLine2: null, city: "C", state: "TX", zip: "78701", email: "a@example.com", phone: null, texasResident: true } as never,
      { fetch: async (r) => { sent = r; return new Response("{}", { status: 201 }); } },
    );
    expect(sent?.headers.get("cookie")).toBe("__Host-sid=abc");
    expect(sent?.headers.get("origin")).toBe("https://droptexas.example");
  });
});
