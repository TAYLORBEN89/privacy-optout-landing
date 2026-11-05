/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { Header } from "../src/Header";
import { SignInPage } from "../src/pages/SignInPage";
import { providerStartHref } from "../src/authGate";

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("sign-in page", () => {
  it("offers Google and Microsoft with a safe return path", () => {
    window.history.pushState({}, "", "/signin?return_to=/account");
    render(<SignInPage />);
    const google = screen.getByRole("link", { name: "Continue with Google" });
    const microsoft = screen.getByRole("link", { name: "Continue with Microsoft" });
    expect(google.getAttribute("href")).toBe("/api/auth/google/start?return_to=%2Faccount");
    expect(microsoft.getAttribute("href")).toBe("/api/auth/microsoft/start?return_to=%2Faccount");
    expect(google.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(google.querySelector("img")?.getAttribute("src")).toBe("/brand/google-sign-in.svg");
    expect(microsoft.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(microsoft.querySelector("img")?.getAttribute("src")).toBe("/brand/microsoft-sign-in.svg");
    expect(screen.queryByRole("link", { name: /Apple/ })).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("keeps a child return path and drops an unsafe one", () => {
    expect(providerStartHref("google", "/start?for=child")).toBe(
      "/api/auth/google/start?return_to=%2Fstart%3Ffor%3Dchild",
    );
    expect(providerStartHref("microsoft", "//evil.example")).toBe("/api/auth/microsoft/start?return_to=%2Faccount");
    window.history.pushState({}, "", "/signin?return_to=//evil.example");
    render(<SignInPage />);
    expect(screen.getByRole("link", { name: "Continue with Google" }).getAttribute("href")).toBe(
      "/api/auth/google/start?return_to=%2Faccount",
    );
  });

  it("defaults a missing return path to /account", () => {
    render(<SignInPage returnTo={null} />);
    expect(screen.getByRole("link", { name: "Continue with Microsoft" }).getAttribute("href")).toBe(
      "/api/auth/microsoft/start?return_to=%2Faccount",
    );
  });
});

describe("header account icon", () => {
  it("links to sign-in when signed out and is not hidden", () => {
    render(<Header signedIn={false} csrf={null} onSignedOut={() => undefined} />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toBe("/signin?return_to=%2Faccount");
    expect(link.getAttribute("aria-hidden")).toBeNull();
    expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("links to the account page when signed in", () => {
    render(<Header signedIn csrf="tok" onSignedOut={() => undefined} />);
    const link = screen.getByRole("link", { name: "Account" });
    expect(link.getAttribute("href")).toBe("/account");
    expect(link.getAttribute("aria-hidden")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("keeps a visible focus ring on the account icon", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const rule = css.slice(css.indexOf(".account-button:focus-visible"), css.indexOf(".sign-out {"));
    expect(rule).toContain("outline: 3px solid var(--blue)");
    expect(rule).toContain("outline-offset: 2px");
  });

  it("ships the provider labels in the page source", () => {
    const source = readFileSync("src/pages/SignInPage.tsx", "utf8");
    expect(source).toContain("Continue with Google");
    expect(source).toContain("Continue with Microsoft");
    expect(source).not.toMatch(/coming soon/i);
  });
});
