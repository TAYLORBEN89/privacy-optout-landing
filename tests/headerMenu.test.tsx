/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Header } from "../src/Header";

afterEach(() => {
  cleanup();
});

describe("header menu", () => {
  it("shows a round account icon that links to sign-in when signed out", () => {
    render(<Header signedIn={false} csrf={null} onSignedOut={() => undefined} />);
    const home = screen.getByRole("link", { name: /DROP Texas/ });
    expect(home.getAttribute("href")).toBe("/");
    expect(home.className).toBe("brand-home");
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toBe("/signin?return_to=%2Faccount");
    expect(link.className).toBe("account-button");
    expect(link.getAttribute("aria-hidden")).toBeNull();
  });

  it("uses the hills nav background and keeps the account button in the header", () => {
    render(<Header signedIn={false} csrf={null} onSignedOut={() => undefined} />);
    const header = document.querySelector("header");
    expect(header?.classList.contains("topbar")).toBe(true);
    expect(header?.classList.contains("topbar--hills")).toBe(true);
    expect(header?.querySelector("a.account-button")).toBeTruthy();
  });

  it("links the account icon to /account when signed in", () => {
    render(<Header signedIn csrf="tok" onSignedOut={() => undefined} />);
    const account = screen.getByRole("link", { name: "Account" });
    expect(account.getAttribute("href")).toBe("/account");
    expect(account.getAttribute("aria-label")).toBe("Account");
    expect(account.className).toBe("account-button");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
});
