import { describe, expect, it } from "vitest";
import { API_BASE, authStartPath } from "../src/api";
import { authGateEnabled, SIGN_IN_HREF, startHref, startPageAction } from "../src/authGate";

describe("auth gate", () => {
  it("is on unless the build flag is false", () => {
    expect(authGateEnabled(undefined)).toBe(true);
    expect(authGateEnabled("")).toBe(true);
    expect(authGateEnabled("true")).toBe(true);
    expect(authGateEnabled("false")).toBe(false);
  });

  it("sends a 401 visitor from the gated form to sign-in", () => {
    expect(startPageAction(true, 401)).toBe("redirect");
    expect(SIGN_IN_HREF).toBe("/signin?return_to=/start");
    expect(startHref(true, false)).toBe("/signin?return_to=/start");
  });

  it("shows the form when the gate is off", () => {
    expect(startPageAction(false, 401)).toBe("form");
    expect(startHref(false, false)).toBe("/start");
  });

  it("shows the form after a 200 and keeps auth on the same origin", () => {
    expect(startPageAction(true, 200)).toBe("form");
    expect(startHref(true, true)).toBe("/start");
    expect(API_BASE).toBe("");
    expect(authStartPath("google")).toBe("/api/auth/google/start?return_to=/start");
    expect(authStartPath("microsoft")).toBe("/api/auth/microsoft/start?return_to=/start");
  });
});
