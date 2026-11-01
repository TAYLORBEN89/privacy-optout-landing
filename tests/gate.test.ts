import { describe, expect, it } from "vitest";
import { ACCOUNTS_ORIGIN, accountsSignInUrl, isSafeReturnPath } from "../shared/accounts";
import { API_BASE } from "../src/api";
import { authGateEnabled, SIGN_IN_HREF, signInHrefFor, startHref, startPageAction } from "../src/authGate";

describe("auth gate", () => {
  it("is on unless the build flag is false", () => {
    expect(authGateEnabled(undefined)).toBe(true);
    expect(authGateEnabled("")).toBe(true);
    expect(authGateEnabled("true")).toBe(true);
    expect(authGateEnabled("false")).toBe(false);
  });

  it("sends a 401 visitor from the gated form to sign-in", () => {
    expect(startPageAction(true, 401)).toBe("redirect");
    expect(ACCOUNTS_ORIGIN).toBe("https://accounts.droptexas.com");
    expect(SIGN_IN_HREF).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    expect(signInHrefFor("/account")).toBe("https://accounts.droptexas.com/signin?return_to=%2Faccount");
    expect(startHref(true, false)).toBe(SIGN_IN_HREF);
  });

  it("shows the form when the gate is off", () => {
    expect(startPageAction(false, 401)).toBe("form");
    expect(startHref(false, false)).toBe("/start");
  });

  it("shows the form after a 200 and keeps auth on the same origin", () => {
    expect(startPageAction(true, 200)).toBe("form");
    expect(startHref(true, true)).toBe("/start");
    expect(API_BASE).toBe("");
    expect(isSafeReturnPath("/start")).toBe(true);
    expect(isSafeReturnPath("/account")).toBe(true);
    expect(isSafeReturnPath("//evil.example")).toBe(false);
    expect(isSafeReturnPath("//evil.example/start")).toBe(false);
    expect(isSafeReturnPath("https://evil.example")).toBe(false);
    expect(isSafeReturnPath("/\\evil.example")).toBe(false);
    expect(accountsSignInUrl("//evil.example")).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    expect(accountsSignInUrl("/account", "https://accounts.example/")).toBe(
      "https://accounts.example/signin?return_to=%2Faccount",
    );
  });
});
