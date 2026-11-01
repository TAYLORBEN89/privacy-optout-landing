/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { accountsLive, signInHrefFor } from "../src/authGate";
import { Header } from "../src/Header";

afterEach(() => {
  cleanup();
});

describe("header menu", () => {
  it("shows a round account icon when signed out", () => {
    render(
      <Header signedIn={false} csrf={null} signInHref={signInHrefFor("/start")} accountsLive onSignedOut={() => undefined} />,
    );
    const link = screen.getByRole("link", { name: "Account" });
    expect(link.getAttribute("href")).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
    expect(link.className).toBe("account-button");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("shows a borderless account icon when signed in", async () => {
    const user = userEvent.setup();
    render(
      <Header signedIn csrf="tok" signInHref={signInHrefFor("/start")} accountsLive onSignedOut={() => undefined} />,
    );
    const account = screen.getByRole("button", { name: "Account" });
    expect(account.getAttribute("aria-label")).toBe("Account");
    expect(account.className).toBe("account-button");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    await user.click(account);
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("hides Sign in and the account icon when accounts is not live", () => {
    expect(accountsLive()).toBe(false);
    const { unmount } = render(
      <Header signedIn={false} csrf={null} signInHref={signInHrefFor("/start")} accountsLive={false} onSignedOut={() => undefined} />,
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
    expect(document.querySelector(".account-button")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    unmount();

    render(
      <Header signedIn csrf="tok" signInHref={signInHrefFor("/start")} accountsLive={false} onSignedOut={() => undefined} />,
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
  });
});
