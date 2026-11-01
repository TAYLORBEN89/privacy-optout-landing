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
  ["More control of your data", ControlBenefitPage, "/start"],
  ["Reduced spam and scams", SpamBenefitPage, "/start"],
  ["Greater security", SecurityBenefitPage, "/start"],
  ["Hours back from paperwork", TimeBenefitPage, "/start"],
  ["Free to make the request", CostBenefitPage, "/start"],
  ["A right you can use", RightsBenefitPage, "/start"],
  ["Protection for your children", ChildrenBenefitPage, "/start?for=child"],
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
      expect(screen.getByRole("heading", { level: 2, name: "The problem" })).toBeTruthy();
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
