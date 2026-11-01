/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TopNav } from "../src/components/TopNav";
import { NAV_ITEMS } from "../src/navItems";

const BLURBS = [
  "Ask brokers to stop selling your information. No fee to send it.",
  "Fill out one form. We send the opt-out requests to the brokers.",
  "We ask only for what a broker needs, and we never sell it.",
  "One request goes to companies that trade your name and phone.",
  "Your name, birth date, and address help match your record.",
  "Texas law gives you the right to opt out of the sale of your data.",
  "Answers on what we send, what we keep, and what we skip.",
  "Pass this page to a Texan who wants their data sold less often.",
];

afterEach(() => {
  cleanup();
});

describe("explore list", () => {
  it("lists the eight sections with their descriptions and anchors", () => {
    render(<TopNav />);
    const nav = screen.getByRole("navigation", { name: "On this site" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.querySelector(".tile-title")?.textContent)).toEqual(
      NAV_ITEMS.map((item) => item.label),
    );
    expect(links.map((link) => link.querySelector(".tile-blurb")?.textContent)).toEqual(BLURBS);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(NAV_ITEMS.map((item) => item.href));
    expect(nav.querySelectorAll(".explore-art")).toHaveLength(8);
    expect(nav.querySelectorAll(".tile-chevron")).toHaveLength(8);
    expect(links.map((link) => link.textContent).join(" ")).not.toMatch(/verified/i);
    expect([...nav.querySelectorAll(".explore-art")].map((icon) => icon.getAttribute("src"))).toEqual([
      expect.stringContaining("overview"),
      expect.stringContaining("how"),
      expect.stringContaining("personal"),
      expect.stringContaining("brokers"),
      expect.stringContaining("identifiers"),
      expect.stringContaining("tdpsa"),
      expect.stringContaining("help"),
      expect.stringContaining("share"),
    ]);
  });

  it("uses a labeled panel, compact rows on a phone, and two columns on a wide screen", () => {
    const page = readFileSync("src/pages/HomePage.tsx", "utf8");
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain("Explore DROP Texas");
    expect(css).toContain("width: 32px");
    expect(css).toContain("min-height: 0");
    expect(css).toContain("padding: 24px 0");
    const tileLink = css.slice(css.indexOf(".nav-tiles a {"), css.indexOf(".nav-tiles a:hover"));
    expect(tileLink).toContain("align-items: flex-start");
    expect(tileLink).toContain("gap: 12px");
    const tileTitle = css.slice(css.indexOf(".tile-title {"), css.indexOf(".tile-blurb"));
    expect(tileTitle).toContain("font-size: 20px");
    expect(tileTitle).toContain("font-weight: 400");
    expect(tileTitle).toContain("line-height: 1.2");
    expect(tileTitle).toContain("text-box-trim: trim-start");
    expect(tileTitle).toContain("text-box-edge: cap alphabetic");
    expect(css).toContain(".nav-tiles .explore-art {\n  width: 48px;\n  height: 48px;");
    expect(css).not.toContain(".nav-tiles .icon-overview");
    expect(css).not.toContain(".feature-card .icon-overview");
    expect(css).toContain(".explore {\n  width: 100%;");
    expect(css).toContain(`@media (min-width: 768px) {
  .explore {
    width: min(720px, 84%);
  }

  .nav-panel {
    padding: 44px 0;
  }

  .nav-panel::before,
  .nav-panel::after {
    height: 34px;
  }

  .nav-tiles a {
    min-height: 86px;
    padding-top: 10px;
    padding-bottom: 10px;
  }
}`);
    expect(css).toContain("grid-template-columns: 1fr 1fr");
    expect(css).toContain(".nav-tiles a:focus-visible");
    expect(css).not.toContain(".nav-tiles li + li");
    expect(css).not.toContain("overflow-y: auto");
    expect(css).not.toContain("max-height: min(68vh, 640px)");
    expect(css).toContain(".nav-panel::before");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("padding: 24px 0");
    expect(css).not.toContain("repeat(8, minmax(0, 1fr))");
    expect(css).not.toContain(".sidenav");
  });
});
