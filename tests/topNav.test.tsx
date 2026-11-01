/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TopNav } from "../src/components/TopNav";
import { NAV_ITEMS } from "../src/navItems";

const BLURBS = [
  "What DROP Texas does, and what an opt-out request is.",
  "The steps from signup to opt-out requests.",
  "What we collect and why.",
  "The companies we send opt-out requests to.",
  "Emails, phones, and IDs brokers track you by.",
  "Your rights under the Texas Data Privacy and Security Act.",
  "Answers to common questions.",
  "Tell a friend about DROP Texas.",
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
    expect(nav.querySelectorAll(".tile-icon")).toHaveLength(8);
    expect(nav.querySelectorAll(".tile-chevron")).toHaveLength(8);
    expect(links.map((link) => link.textContent).join(" ")).not.toMatch(/verified/i);
    const strokes = [...nav.querySelectorAll(".tile-icon")].map((icon) => icon.getAttribute("stroke-width"));
    expect(strokes).toEqual(["1.5", "1.5", "1.5", "1.5", "1.5", "1.5", "1.5", "1.5"]);
    expect(nav.querySelector(".icon-help circle")?.getAttribute("r")).toBe("10");
    expect(nav.querySelector(".icon-help")?.innerHTML).toContain("M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3");
    expect(nav.querySelectorAll(".icon-share circle")).toHaveLength(3);
    expect(nav.querySelector(".icon-unique-identifiers")?.innerHTML).toContain("M2 12a10 10 0 0 1 18-6");
  });

  it("uses a labeled panel, tall rows on a phone, and two columns on a wide screen", () => {
    const page = readFileSync("src/pages/HomePage.tsx", "utf8");
    const css = readFileSync("src/styles.css", "utf8");
    expect(page).toContain("Explore DROP Texas");
    expect(css).toContain("width: 32px");
    expect(css).toContain("min-height: 110px");
    const tileLink = css.slice(css.indexOf(".nav-tiles a {"), css.indexOf(".nav-tiles a:hover"));
    expect(tileLink).toContain("align-items: flex-start");
    expect(tileLink).toContain("gap: 12px");
    const tileTitle = css.slice(css.indexOf(".tile-title {"), css.indexOf(".tile-blurb"));
    expect(tileTitle).toContain("font-size: 20px");
    expect(tileTitle).toContain("font-weight: 400");
    expect(tileTitle).toContain("line-height: 1.2");
    expect(tileTitle).toContain("text-box-trim: trim-start");
    expect(tileTitle).toContain("text-box-edge: cap alphabetic");
    expect(css).toContain(".nav-tiles .icon-overview");
    expect(css).toContain(".nav-tiles .icon-personal-information {\n  transform: translateY(-8.25px);");
    expect(css).toContain(".nav-tiles .icon-data-brokers {\n  transform: translateY(-8px);");
    expect(css).toContain(".nav-tiles .icon-tdpsa {\n  transform: translateY(-4.5px);");
    expect(css).toContain(".nav-tiles .icon-share {\n  transform: translateY(-3px);");
    expect(css).not.toContain(".feature-card .icon-overview");
    expect(css).toContain(".explore {\n  width: 100%;");
    expect(css).toContain("grid-template-columns: 1fr 1fr");
    expect(css).toContain(".nav-tiles a:focus-visible");
    expect(css).not.toContain(".nav-tiles li + li");
    expect(css).not.toContain("overflow-y: auto");
    expect(css).not.toContain("max-height: min(68vh, 640px)");
    expect(css).toContain(".nav-panel::before");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("padding: 72px 0");
    expect(css).not.toContain("repeat(8, minmax(0, 1fr))");
    expect(css).not.toContain(".sidenav");
  });
});
