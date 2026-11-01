/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
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
    const dob = screen.getByLabelText(/Date of birth/) as HTMLInputElement;
    expect(dob.type).toBe("date");
    expect(dob.getAttribute("autocomplete")).toBe("bday");
    expect(dob.required || dob.getAttribute("aria-required")).toBeTruthy();
    expect(screen.getByLabelText(/Street address/)).toBeTruthy();
    expect(screen.getByLabelText(/Apt, suite, unit/)).toBeTruthy();
    expect(screen.getByLabelText(/City/)).toBeTruthy();
    expect(screen.getByLabelText(/State/)).toBeTruthy();
    expect(screen.getByLabelText(/ZIP code/)).toBeTruthy();
    expect(screen.getByLabelText(/Phone number \(optional\)/)).toBeTruthy();
    expect(screen.getByLabelText(/I live in Texas/)).toBeTruthy();
    const hint = document.getElementById("texasResident-hint");
    expect(hint?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Texas residents are covered by the Texas Data Privacy and Security Act (TDPSA). See your rights.",
    );
    expect(screen.getByRole("link", { name: "See your rights" }).getAttribute("href")).toBe("/tdpsa");
    expect(screen.getByLabelText(/I live in Texas/).getAttribute("aria-describedby")).toBe("texasResident-hint");
    expect(document.querySelectorAll(".hint")).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Data brokers also track people by phone number.");
    expect(document.body.textContent).not.toContain("First and last name.");
    expect(document.body.textContent).not.toContain("Street, city, state, and ZIP code.");
    expect(document.body.textContent).not.toContain("Most broker opt-out forms require a physical address.");
    expect(document.body.textContent).not.toContain("A checked box means the Texas Data Privacy and Security Act");
    expect(document.body.textContent).not.toContain("Leave it unchecked if you live somewhere else.");
    expect(document.body.textContent).not.toContain("You can still submit.");
    expect(document.body.textContent).toContain("This is a preview. Nothing you enter is saved yet.");
    const state = screen.getByLabelText(/State/) as HTMLSelectElement;
    expect(state.value).toBe("TX");
    expect(state.querySelectorAll("option")).toHaveLength(51);
    const order = [...document.querySelectorAll(".form-grid input, .form-grid select")].map((el) => el.id);
    expect(order).toEqual([
      "firstName",
      "middleName",
      "lastName",
      "dob",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "zip",
      "email",
      "phone",
      "texasResident",
    ]);
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("width: min(640px, 100%)");
    expect(css).toContain("grid-template-columns: repeat(12, minmax(0, 1fr))");
    expect(css).not.toContain(".address-row");
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
