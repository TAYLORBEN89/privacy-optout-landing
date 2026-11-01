/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SignInPage } from "../src/pages/SignInPage";

afterEach(() => {
  cleanup();
});

describe("sign-in page", () => {
  it("offers Google and Microsoft on the same origin", () => {
    render(<SignInPage />);
    const providers = screen.getAllByRole("link").filter((link) => link.className.split(" ").includes("provider"));
    expect(providers.map((link) => link.textContent)).toEqual([
      "Continue with Google",
      "Continue with Microsoft",
    ]);
    expect(providers.map((link) => link.getAttribute("href"))).toEqual([
      "/api/auth/google/start?return_to=/start",
      "/api/auth/microsoft/start?return_to=/start",
    ]);
    expect((screen.getByRole("button", { name: "More options" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
