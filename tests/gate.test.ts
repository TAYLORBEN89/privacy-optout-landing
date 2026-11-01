import { describe, expect, it } from "vitest";
import { ACCOUNTS_ORIGIN, accountsSignInUrl, isSafeReturnPath } from "../shared/accounts";
import { API_BASE } from "../src/api";
import { accountsLive, authGateEnabled, SIGN_IN_HREF, signInHrefFor, startHref, startPageAction } from "../src/authGate";

describe("auth gate", () => {
  it("is on unless the build flag is false", () => {
    expect(authGateEnabled(undefined)).toBe(true);
    expect(authGateEnabled("")).toBe(true);
    expect(authGateEnabled("true")).toBe(true);
    expect(authGateEnabled("false")).toBe(false);
  });

  it("sends a 401 visitor from the gated form to sign-in", () => {
    expect(startPageAction(true, 401, true)).toBe("redirect");
    expect(ACCOUNTS_ORIGIN).toBe("https://accounts.droptexas.com");
    expect(SIGN_IN_HREF).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    expect(signInHrefFor("/account")).toBe("https://accounts.droptexas.com/signin?return_to=%2Faccount");
    expect(startHref(true, false, true)).toBe(SIGN_IN_HREF);
  });

  it("hides accounts while VITE_ACCOUNTS_LIVE is unset, and redirects only when it is on", () => {
    expect(accountsLive(undefined)).toBe(false);
    expect(accountsLive("")).toBe(false);
    expect(accountsLive("false")).toBe(false);
    expect(accountsLive("0")).toBe(false);
    expect(accountsLive("true")).toBe(true);
    expect(accountsLive("1")).toBe(true);
    expect(startPageAction(true, 401)).toBe("form");
    expect(startHref(true, false)).toBe("/start");
    expect(startPageAction(true, 401, true)).toBe("redirect");
    expect(startHref(true, false, true)).toBe(SIGN_IN_HREF);
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
    expect(isSafeReturnPath("/start#step-1")).toBe(true);
    expect(isSafeReturnPath("/start#step-12")).toBe(true);
    expect(isSafeReturnPath("/start#step-99")).toBe(true);
    expect(isSafeReturnPath("/start#step-0")).toBe(false);
    expect(isSafeReturnPath("/start#step-100")).toBe(false);
    expect(isSafeReturnPath("/start#step-01")).toBe(false);
    expect(isSafeReturnPath("/security")).toBe(false);
    expect(isSafeReturnPath("//evil.example")).toBe(false);
    expect(isSafeReturnPath("//evil.example/start")).toBe(false);
    expect(isSafeReturnPath("https://evil.example")).toBe(false);
    expect(isSafeReturnPath("/\\evil.example")).toBe(false);
    expect(accountsSignInUrl("/start#step-2")).toBe(
      "https://accounts.droptexas.com/signin?return_to=%2Fstart%23step-2",
    );
    expect(accountsSignInUrl("/security")).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    expect(accountsSignInUrl("//evil.example")).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    expect(accountsSignInUrl("/account", "https://accounts.example/")).toBe(
      "https://accounts.example/signin?return_to=%2Faccount",
    );
  });
});
