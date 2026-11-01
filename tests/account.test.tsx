/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AccountView } from "../src/pages/AccountPage";

afterEach(() => {
  cleanup();
});

describe("account dashboard", () => {
  it("shows empty states instead of fake requests", () => {
    render(
      <AccountView
        profile={{ name: "Ada Lovelace", email: "ada@example.com" }}
        requests={[]}
        reminders={[]}
      />,
    );
    expect(screen.getByText("No requests yet")).toBeTruthy();
    expect(screen.getByText("No reminders yet")).toBeTruthy();
    expect(screen.getByText("Name: Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText(/confirmation/i)).toBeNull();
  });
});
