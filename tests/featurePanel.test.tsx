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
    expect(screen.getByRole("heading", { name: "Three steps to opt out" })).toBeTruthy();
    expect(screen.getByText("Sign up, confirm your details, and we send opt-out requests to data brokers for you.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See how it works >" }).getAttribute("href")).toBe("/#how-drop-works");
    expect(screen.getByRole("link", { name: "See the brokers >" }).getAttribute("href")).toBe("/#data-brokers");
    expect(screen.getByText(/Acxiom, Experian/)).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(document.body.textContent).not.toMatch(/verified/i);
  });

  it("overlaps a two-column panel onto the yellow section", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("margin: 28px auto -100px");
    expect(css).toContain("box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12)");
    expect(css).toContain("padding: 140px 24px 64px");
    expect(css).toContain("grid-template-columns: 1fr 1fr");
    expect(css).toContain("width: min(1100px, 100%)");
    expect(css).toContain("border: 1.5px solid currentColor");
  });
});
