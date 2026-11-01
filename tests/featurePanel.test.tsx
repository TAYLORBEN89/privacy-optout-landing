/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeaturePanel } from "../src/components/FeaturePanel";

afterEach(() => {
  cleanup();
});

describe("feature panel", () => {
  it("shows benefit cards with honest copy and links to benefit pages", () => {
    render(<FeaturePanel />);
    expect(screen.getByRole("heading", { name: "More control of your data" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reduced spam and scams" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Greater security" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Hours back from paperwork" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Free to make the request" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "A right you can use" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Protection for your children" })).toBeTruthy();
    expect(screen.getByText("Limit the information data brokers collect and sell about you.")).toBeTruthy();
    expect(screen.getByText("Fewer sold lists can mean fewer unwanted calls, texts, and emails.")).toBeTruthy();
    expect(screen.getByText("Less of your information in circulation can lower the risk of fraud.")).toBeTruthy();
    expect(screen.getByText("One form, instead of a separate opt-out at each broker.")).toBeTruthy();
    expect(screen.getByText("DROP Texas does not charge you to send opt-out requests.")).toBeTruthy();
    expect(screen.getByText("Texas law lets you opt out of the sale of your personal data.")).toBeTruthy();
    expect(screen.getByText("A parent can ask brokers not to sell a child's information.")).toBeTruthy();
    expect(screen.getByText("Children")).toBeTruthy();
    expect(screen.getByText("Control")).toBeTruthy();
    expect(screen.getByText("Spam")).toBeTruthy();
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.getByText("Cost")).toBeTruthy();
    expect(screen.getByText("Texas law")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See how control works >" }).getAttribute("href")).toBe("/benefits/control");
    expect(screen.getByRole("link", { name: "See how this helps >" }).getAttribute("href")).toBe("/benefits/spam");
    expect(screen.getByRole("link", { name: "See the security benefit >" }).getAttribute("href")).toBe(
      "/benefits/security",
    );
    expect(screen.getByRole("link", { name: "See the time you save >" }).getAttribute("href")).toBe("/benefits/time");
    expect(screen.getByRole("link", { name: "See what is free >" }).getAttribute("href")).toBe("/benefits/cost");
    expect(screen.getByRole("link", { name: "See the right >" }).getAttribute("href")).toBe("/benefits/rights");
    expect(screen.getByRole("link", { name: "See children's protection >" }).getAttribute("href")).toBe(
      "/benefits/children",
    );
    expect(screen.getAllByRole("link")).toHaveLength(7);
    const strokes = [...document.querySelectorAll(".feature-card .tile-icon")].map((icon) =>
      icon.getAttribute("stroke-width"),
    );
    expect(strokes).toEqual(["2", "2", "2", "2", "2", "2", "2"]);
    expect(document.querySelector(".feature-card-unique-identifiers .tile-icon")?.innerHTML).toContain(
      "M12 19c0-3 .2-5 .2-7a3.2 3.2 0 0 1 6.4 0",
    );
    expect(document.querySelector(".feature-card-unique-identifiers .tile-icon")?.innerHTML).not.toContain(
      "M2 12a10 10 0 0 1 18-6",
    );
    expect(document.body.textContent).not.toMatch(/verified/i);
  });

  it("overlaps a two-column panel onto the yellow section", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("margin: 28px auto -100px");
    expect(css).toContain("box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12)");
    expect(css).toContain("padding: 140px 24px 72px");
    expect(css).toContain("grid-template-columns: 1fr 1fr");
    const brokers = css.slice(css.indexOf(".feature-card-data-brokers {"), css.indexOf(".feature-card-unique-identifiers"));
    expect(brokers).toContain("background: #f7f7f8");
    expect(brokers).not.toContain("linear-gradient");
    const closing = css.slice(css.indexOf(".closing {"), css.indexOf(".closing .cta"));
    expect(closing).toContain("background: var(--bg)");
    expect(closing).not.toContain("linear-gradient");
    expect(css).toContain("width: min(1100px, 100%)");
    expect(css).toContain("border: 1.5px solid currentColor");
  });
});
