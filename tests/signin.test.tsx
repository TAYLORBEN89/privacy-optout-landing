/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInPage } from "../src/pages/SignInPage";
import { Header } from "../src/Header";
import { signInHrefFor } from "../src/authGate";

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("sign-in redirect", () => {
  it("sends /signin to the accounts host and keeps return_to", () => {
    window.history.pushState({}, "", "/signin?return_to=/account");
    const goTo = vi.fn();
    render(<SignInPage goTo={goTo} />);
    expect(goTo).toHaveBeenCalledWith("https://accounts.droptexas.com/signin?return_to=%2Faccount");
    expect(screen.getByText("Sending you to sign in…")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Google|Microsoft/ })).toBeNull();
  });

  it("replaces an unsafe return_to with /start", () => {
    window.history.pushState({}, "", "/signin?return_to=//evil.example");
    const goTo = vi.fn();
    render(<SignInPage goTo={goTo} />);
    expect(goTo).toHaveBeenCalledWith("https://accounts.droptexas.com/signin?return_to=%2Fstart");
  });

  it("lets the header Sign in link leave the page", () => {
    render(
      <Header
        signedIn={false}
        csrf={null}
        signInHref={signInHrefFor("/start")}
        onSignedOut={() => undefined}
      />,
    );
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toBe(signInHrefFor("/start"));
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
