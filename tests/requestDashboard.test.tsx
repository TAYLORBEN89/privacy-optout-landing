/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequestDashboard } from "../src/components/RequestDashboard";

afterEach(() => {
  cleanup();
});

describe("broker registry rows", () => {
  it("uses a wrapping name and an opt-out pill that names the company", () => {
    render(<RequestDashboard optouts={[]} />);
    const name = screen.getByText("The Segerdahl LLC d/b/a sg360°");
    expect(name.className).toBe("broker-row-name");
    const link = screen.getByRole("link", { name: "Opt-out page for The Segerdahl LLC d/b/a sg360°" });
    expect(link.textContent).toBe("Opt-out page");
    expect(link.className).toBe("broker-optout");
    expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    const css = readFileSync("src/styles.css", "utf8");
    const card = css.slice(css.indexOf(".broker-row {"), css.indexOf(".broker-row-name {"));
    expect(card).toContain("border: 1px solid var(--line)");
    expect(card).toContain("border-radius: 10px");
    expect(card).toContain("background: #fff");
    const row = css.slice(css.indexOf(".broker-row-name {"), css.indexOf(".broker-optout {"));
    expect(row).toContain("font-size: 15px");
    expect(row).toContain("font-weight: 600");
    expect(row).toContain("white-space: normal");
    expect(row).toContain("overflow-wrap: anywhere");
    const strip = css.slice(css.indexOf(".broker-name {"), css.indexOf(".broker-name:nth-child"));
    expect(strip).toContain("font-weight: 800");
    expect(strip).toContain("white-space: nowrap");
  });
});
