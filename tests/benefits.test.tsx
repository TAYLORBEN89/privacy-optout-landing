/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ChildrenBenefitPage,
  ControlBenefitPage,
  CostBenefitPage,
  RightsBenefitPage,
  SecurityBenefitPage,
  SpamBenefitPage,
  TimeBenefitPage,
} from "../src/pages/benefits";

const PAGES = [
  ["Control your data", ControlBenefitPage, "/start"],
  ["Data broker mail", SpamBenefitPage, "/start"],
  ["Broker data exposure", SecurityBenefitPage, "/start"],
  ["One opt-out form", TimeBenefitPage, "/start"],
  ["Free privacy tools", CostBenefitPage, "/start"],
  ["Texas privacy rights", RightsBenefitPage, "/start"],
  ["Child data privacy", ChildrenBenefitPage, "/start?for=child"],
] as const;

afterEach(() => {
  cleanup();
});

describe("benefit pages", () => {
  it("explains the problem, gives examples, and starts an opt-out", () => {
    for (const [heading, Page, href] of PAGES) {
      cleanup();
      render(<Page />);
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 2, name: /problem/i })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 2, name: "Examples" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 2, name: "How DROP Texas helps" })).toBeTruthy();
      expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
      expect(screen.getByRole("link", { name: "Start my opt-out" }).getAttribute("href")).toBe(href);
      expect(document.body.textContent).not.toMatch(/verified deletion|guaranteed/i);
    }
  });

  it("keeps the three benefit statements and points children at the sourced page", () => {
    render(<ControlBenefitPage />);
    expect(document.body.textContent).toContain(
      "which may include your Social Security number, data about your children, search history, and much more.",
    );
    cleanup();
    render(<SpamBenefitPage />);
    expect(document.body.textContent).toContain("Results will vary by consumer and may take time to notice.");
    expect(screen.getByRole("link", { name: "donotcall.gov" }).getAttribute("href")).toBe("https://www.donotcall.gov");
    cleanup();
    render(<SecurityBenefitPage />);
    expect(document.body.textContent).toContain(
      "Limiting the spread of your personal information can reduce your risk of identity theft and targeted fraud.",
    );
    cleanup();
    render(<ChildrenBenefitPage />);
    expect(screen.getAllByRole("link", { name: "children's information page" })[0]?.getAttribute("href")).toBe(
      "/children",
    );
  });
});

describe("homepage benefit cards", () => {
  it("are square and trim icon spacing instead of shrinking text", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles.css", "utf8");
    const block = css.slice(css.indexOf("/* Square benefit cards"));
    expect(block).toContain("aspect-ratio: 1 / 1;");
    expect(block).not.toMatch(/\.feature-card p \{[^}]*font-size/);
  });
});
