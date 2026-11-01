/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DISCLAIMER } from "../src/copy";
import { SiteFooter } from "../src/Footer";
import { SignupForm } from "../src/SignupForm";
import { StartPage } from "../src/pages/StartPage";

afterEach(() => {
  cleanup();
});

describe("signup form copy", () => {
  it("keeps labels and the shortened Texas note, and drops field hints", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/First name/)).toBeTruthy();
    expect(screen.getByLabelText(/Middle name/)).toBeTruthy();
    expect(screen.getByLabelText(/Last name/)).toBeTruthy();
    expect(screen.getByLabelText(/Street address/)).toBeTruthy();
    expect(screen.getByLabelText(/Apt, suite, unit/)).toBeTruthy();
    expect(screen.getByLabelText(/City/)).toBeTruthy();
    expect(screen.getByLabelText(/State/)).toBeTruthy();
    expect(screen.getByLabelText(/ZIP code/)).toBeTruthy();
    expect(screen.getByLabelText(/Phone number \(optional\)/)).toBeTruthy();
    expect(screen.getByLabelText(/I live in Texas/)).toBeTruthy();
    expect(screen.getByText("Check this if you live in Texas. An unchecked box still uses TDPSA for now and is marked non-Texas.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Data brokers also track people by phone number.");
    expect(document.body.textContent).not.toContain("First and last name.");
    expect(document.body.textContent).not.toContain("Street, city, state, and ZIP code.");
    expect(document.body.textContent).not.toContain("Most broker opt-out forms require a physical address.");
    expect(document.body.textContent).not.toContain("A checked box means the Texas Data Privacy and Security Act");
    expect(document.body.textContent).not.toContain("Leave it unchecked if you live somewhere else.");
    expect(document.body.textContent).not.toContain("You can still submit.");
    expect(document.body.textContent).toContain("This preview checks your details and does not store them yet.");
    const state = screen.getByLabelText(/State/) as HTMLSelectElement;
    expect(state.value).toBe("TX");
    expect(state.querySelectorAll("option")).toHaveLength(51);
  });

  it("does not repeat the disclaimer above the form, and the footer still has it", () => {
    const page = render(<StartPage action="form" />);
    expect(page.queryByText(DISCLAIMER)).toBeNull();
    expect(page.getByRole("heading", { name: "Send your request" })).toBeTruthy();
    page.unmount();

    render(
      <>
        <StartPage action="form" />
        <SiteFooter />
      </>,
    );
    const matches = screen.getAllByText(DISCLAIMER);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.closest("footer")).toBeTruthy();
  });
});
