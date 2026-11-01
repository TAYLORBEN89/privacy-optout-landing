/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setAnalyticsSink, type AnalyticsEvent } from "../src/analytics";
import { DISCLAIMER } from "../src/copy";
import { SiteFooter } from "../src/Footer";
import { SignupForm } from "../src/SignupForm";
import { StartPage } from "../src/pages/StartPage";

afterEach(() => {
  cleanup();
  setAnalyticsSink(() => {});
  vi.unstubAllGlobals();
});

function fillRequest(phone: string) {
  const values: Record<string, string> = {
    firstName: "Ada",
    lastName: "Lovelace",
    dob: "1990-01-15",
    addressLine1: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    email: "ada@example.com",
    phone,
  };
  for (const [id, value] of Object.entries(values)) {
    fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });
  }
  fireEvent.click(screen.getByLabelText(/I live in Texas/));
}

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

describe("signup form phone", () => {
  it("shows the US phone error and keeps the typed number out of analytics", async () => {
    const user = userEvent.setup();
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => {
      events.push(event);
    });
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    render(<SignupForm />);
    fillRequest("123");
    await user.click(screen.getByRole("button", { name: "Submit opt-out request" }));

    expect(await screen.findByText("Enter a valid US phone number.")).toBeTruthy();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(events).toContainEqual({ event: "field_error", field: "phone", code: "invalid" });
    expect(JSON.stringify(events)).not.toContain("123");
    expect(JSON.stringify(events)).not.toMatch(/\+1\d{10}/);
  });

  it("posts an E.164 phone and does not send that value to analytics", async () => {
    const user = userEvent.setup();
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => {
      events.push(event);
    });
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(String(init?.body));
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
    render(<SignupForm />);
    fillRequest("(512) 555-0100");
    await user.click(screen.getByRole("button", { name: "Submit opt-out request" }));

    expect(await screen.findByText(/Confirmation received/)).toBeTruthy();
    expect(JSON.parse(bodies[0] ?? "{}").phone).toBe("+15125550100");
    expect(events).toContainEqual({ event: "submitted" });
    const tracked = JSON.stringify(events);
    expect(tracked).not.toContain("512");
    expect(tracked).not.toContain("+15125550100");
    expect(tracked).not.toContain("(512) 555-0100");
  });
});
