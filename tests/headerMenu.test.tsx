/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Header } from "../src/Header";

afterEach(() => {
  cleanup();
});

describe("header menu", () => {
  it("opens and closes the slide-out from the hamburger", async () => {
    const user = userEvent.setup();
    render(
      <Header signedIn={false} csrf={null} signInHref="/signin?return_to=/start" onSignedOut={() => undefined} />,
    );
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Site menu" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
