import { describe, expect, it } from "vitest";
import { linkSignupToAccount, sessionCookieOnly } from "../worker/accountLink";
import type { SignupInput } from "../shared/signup";
import { testSigner } from "./helpers/proxyKeys";

describe("account link forwards only the session cookie", () => {
  it("drops every other cookie", () => {
    expect(sessionCookieOnly("_ga=1; __Host-sid=abc; pref=x")).toBe("__Host-sid=abc");
    expect(sessionCookieOnly("sid=1; other=2")).toBe("");
    expect(sessionCookieOnly("__Host-sid=a;b")).toBe("__Host-sid=a");
  });

  it("signs the link call and sends no client CSRF or Origin", async () => {
    let sent: Request | undefined;
    const input = { firstName: "A", middleName: null, lastName: "B", addressLine1: "1", addressLine2: null, city: "C", state: "TX", zip: "78701", email: "a@example.com", phone: null, texasResident: true } as unknown as SignupInput;
    await linkSignupToAccount(
      "https://droptexas.com/api/signup",
      "_ga=1; __Host-sid=abc",
      "203.0.113.9",
      input,
      { fetch: async (r: Request) => { sent = r; return new Response("{}", { status: 201 }); } },
      await testSigner(),
    );
    expect(sent?.headers.get("cookie")).toBe("__Host-sid=abc");
    expect(sent?.headers.get("origin")).toBe("https://droptexas.com");
    expect(sent?.headers.get("x-csrf-token")).toBeNull();
    expect(sent?.headers.get("cf-connecting-ip")).toBe("203.0.113.9");
    expect(sent?.headers.get("x-internal-auth")).toMatch(/^v1\.k1\./);
  });
});
