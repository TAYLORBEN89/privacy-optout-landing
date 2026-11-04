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
    render(<StartPage action="redirect" goTo={goTo} live={false} />);
    expect(goTo).toHaveBeenCalledWith("/signin?return_to=%2Fstart%3Ffor%3Dchild");
  });

  it("shows the form when the visitor is signed in", () => {
    window.history.pushState({}, "", "/start");
    render(<StartPage action="form" />);
    expect(screen.getByRole("radio", { name: "Myself" })).toBeTruthy();
  });

  it("round-trips a safe return path and rejects open redirects", () => {
    expect(isSafeReturnPath("/start?for=child")).toBe(true);
    expect(accountsSignInUrl("/start?for=child")).toBe(
      "https://accounts.droptexas.com/signin?return_to=%2Fstart%3Ffor%3Dchild",
    );
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "javascript:alert(1)", "/start/../etc", ""]) {
      expect(isSafeReturnPath(bad), bad).toBe(false);
      expect(accountsSignInUrl(bad)).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    }
  });
});
