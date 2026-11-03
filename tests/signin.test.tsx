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
    render(<SignInPage goTo={goTo} live />);
    expect(goTo).toHaveBeenCalledWith("https://accounts.droptexas.com/signin?return_to=%2Faccount");
    expect(screen.getByText("Sending you to sign in…")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Google|Microsoft/ })).toBeNull();
  });

  it("keeps a form step in the encoded return path", () => {
    window.history.pushState({}, "", `/signin?return_to=${encodeURIComponent("/start#step-3")}`);
    const goTo = vi.fn();
    render(<SignInPage goTo={goTo} live />);
    expect(goTo).toHaveBeenCalledWith("https://accounts.droptexas.com/signin?return_to=%2Fstart%23step-3");
  });

  it("replaces an unsafe return_to with /start", () => {
    window.history.pushState({}, "", "/signin?return_to=//evil.example");
    const goTo = vi.fn();
    render(<SignInPage goTo={goTo} live />);
    expect(goTo).toHaveBeenCalledWith("https://accounts.droptexas.com/signin?return_to=%2Fstart");
  });

  it("shows Coming soon and does not leave the site while accounts are not live", () => {
    const goTo = vi.fn();
    render(<SignInPage goTo={goTo} live={false} />);
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeTruthy();
    expect(screen.queryByText("Sending you to sign in…")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Your account" })).toBeNull();
  });

  it("lets the header Sign in link leave the page", () => {
    render(
      <Header
        signedIn={false}
        csrf={null}
        signInHref={signInHrefFor("/start")}
        accountsLive
        onSignedOut={() => undefined}
      />,
    );
    const link = screen.getByRole("link", { name: "Account" });
    expect(link.getAttribute("href")).toBe(signInHrefFor("/start"));
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
