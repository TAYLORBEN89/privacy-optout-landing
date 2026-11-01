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
  it("shows the first menu topics as tinted cards with honest copy", () => {
    render(<FeaturePanel />);
    expect(screen.getByRole("heading", { name: "Take back your privacy for free" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Save hours of paperwork" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Share less to protect more" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Fewer lists with your name on them" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Get matched correctly" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Know your rights work for you" })).toBeTruthy();
    expect(screen.getByText("Ask brokers to stop selling your information at no cost.")).toBeTruthy();
    expect(screen.getByText("We handle the broker forms so you don't have to.")).toBeTruthy();
    expect(screen.getByText("We collect the minimum and never sell it.")).toBeTruthy();
    expect(screen.getByText("Reach the companies that trade your address and phone.")).toBeTruthy();
    expect(screen.getByText("The right details help brokers find the right record.")).toBeTruthy();
    expect(screen.getByText("Texas law gives you the right to opt out of the sale of your data.")).toBeTruthy();
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("How it works")).toBeTruthy();
    expect(screen.getByText("Personal information")).toBeTruthy();
    expect(screen.getByText("Data brokers")).toBeTruthy();
    expect(screen.getByText("Unique identifiers")).toBeTruthy();
    expect(screen.getByText("TDPSA")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See the overview >" }).getAttribute("href")).toBe("/overview");
    expect(screen.getByRole("link", { name: "See how it works >" }).getAttribute("href")).toBe("/how-it-works");
    expect(screen.getByRole("link", { name: "See what we ask >" }).getAttribute("href")).toBe("/personal-information");
    expect(screen.getByRole("link", { name: "See the brokers >" }).getAttribute("href")).toBe("/data-brokers");
    expect(screen.getByRole("link", { name: "See the identifiers >" }).getAttribute("href")).toBe("/unique-identifiers");
    expect(screen.getByRole("link", { name: "Read about TDPSA >" }).getAttribute("href")).toBe("/tdpsa");
    expect(screen.getAllByRole("link")).toHaveLength(6);
    const strokes = [...document.querySelectorAll(".feature-card .tile-icon")].map((icon) =>
      icon.getAttribute("stroke-width"),
    );
    expect(strokes).toEqual(["2", "2", "2", "2", "2", "2"]);
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
    expect(closing).toContain("background: #fff");
    expect(closing).not.toContain("linear-gradient");
    expect(css).toContain("width: min(1100px, 100%)");
    expect(css).toContain("border: 1.5px solid currentColor");
  });
});
