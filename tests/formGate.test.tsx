/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartPage } from "../src/pages/StartPage";
import { accountsSignInUrl, isSafeReturnPath } from "../shared/accounts";

afterEach(() => {
  cleanup();
});

describe("opt-out form sign-in gate", () => {
  it("sends a signed-out visitor to sign-in with return_to", () => {
    const goTo = vi.fn();
    window.history.pushState({}, "", "/start?for=child");
    render(<StartPage action="redirect" goTo={goTo} live />);
    expect(screen.getByText("Sending you to sign in…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(goTo).toHaveBeenCalledWith(accountsSignInUrl("/start?for=child"));
    cleanup();
    goTo.mockClear();
    window.history.pushState({}, "", "/start#step-2");
    render(<StartPage action="redirect" goTo={goTo} live={false} />);
    expect(goTo).toHaveBeenCalledWith("/signin?return_to=%2Fstart%23step-2");
  });

  it("shows the form when the visitor is signed in", () => {
    window.history.pushState({}, "", "/start");
    render(<StartPage action="form" />);
    expect(screen.getByRole("radio", { name: "Myself" })).toBeTruthy();
  });

  it("round-trips an allowlisted return path and rejects open redirects", () => {
    expect(isSafeReturnPath("/start")).toBe(true);
    expect(isSafeReturnPath("/account")).toBe(true);
    expect(isSafeReturnPath("/start#step-2")).toBe(true);
    expect(isSafeReturnPath("/start?for=child")).toBe(true);
    expect(accountsSignInUrl("/start?for=child")).toBe(
      "https://accounts.droptexas.com/signin?return_to=%2Fstart%3Ffor%3Dchild",
    );
    for (const other of ["/start?for=self", "/start?for=child&extra=1", "/account?next=1", "/start?for=child#step-1"]) {
      expect(isSafeReturnPath(other), other).toBe(false);
      expect(accountsSignInUrl(other)).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    }
    expect(accountsSignInUrl("/start#step-2")).toBe(
      "https://accounts.droptexas.com/signin?return_to=%2Fstart%23step-2",
    );
    const cases = [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "data:text/html,hi",
      "%2F%2Fevil.example",
      "/start%2F%2Fevil",
      "%5Cevil.example",
      "/start%5Cetc",
      "/\t/evil.com",
      "/\r/evil.com",
      "/\n/evil.com",
      "/\u0000/evil.com",
      "/\u007f/evil.com",
      `/${"a".repeat(2048)}`,
      "/%09/evil.com",
      "/%0d/evil.com",
      "/%0a/evil.com",
      "/start/../account",
    ];
    for (const bad of cases) {
      expect(isSafeReturnPath(bad), JSON.stringify(bad)).toBe(false);
      expect(accountsSignInUrl(bad)).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    }
    expect(`/${"a".repeat(2048)}`.length).toBe(2049);
  });
});
