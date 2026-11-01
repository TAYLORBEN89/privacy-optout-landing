/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { authErrorMessage } from "../src/authError";
import { AccountPage } from "../src/pages/AccountPage";
import { StartPage } from "../src/pages/StartPage";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("auth_error on return", () => {
  it("maps the four handoff failures and ignores retired codes", () => {
    expect(authErrorMessage("bad_start")).toBe("That sign-in link expired. Please try again.");
    expect(authErrorMessage("start_reused")).toBe("That sign-in link expired. Please try again.");
    expect(authErrorMessage("browser_mismatch")).toBe(
      "Please finish signing in using the same browser you started in.",
    );
    expect(authErrorMessage("identity_in_use")).toBe(
      "That Google or Microsoft account is already linked to another DROP Texas account.",
    );
    expect(authErrorMessage("bad_intent")).toBeNull();
    expect(authErrorMessage("intent_reused")).toBeNull();
  });

  it("shows a browser mismatch on /account and strips the query", async () => {
    window.history.pushState({}, "", "/account?auth_error=browser_mismatch&keep=1");
    render(<AccountPage action="unavailable" me={null} />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Please finish signing in using the same browser you started in.",
    );
    expect(window.location.pathname).toBe("/account");
    expect(window.location.search).toBe("?keep=1");
  });

  it("shows an expired link on /start and strips retired codes without a message", async () => {
    window.history.pushState({}, "", "/start?auth_error=start_reused");
    const { unmount } = render(<StartPage action="form" />);
    expect((await screen.findByRole("alert")).textContent).toBe("That sign-in link expired. Please try again.");
    expect(window.location.search).toBe("");
    unmount();

    window.history.pushState({}, "", "/start?auth_error=bad_intent");
    render(<StartPage action="form" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.location.search).toBe("");

    window.history.pushState({}, "", "/account?auth_error=intent_reused");
    render(<AccountPage action="unavailable" me={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.location.search).toBe("");
  });
});
