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
    expect(css).toContain("font-size: 22px");
    expect(css).toContain(".explore {\n  width: 100%;");
    expect(css).toContain("grid-template-columns: 1fr 1fr");
    expect(css).toContain(".nav-tiles a:focus-visible");
    expect(css).not.toContain(".nav-tiles li + li");
    expect(css).toContain("mask-image: linear-gradient(to bottom, transparent, #000 28px, #000 calc(100% - 28px), transparent)");
    expect(css).toContain("border-radius: 0");
    expect(css).toContain("margin-inline: 8px");
    expect(css).not.toContain("repeat(8, minmax(0, 1fr))");
    expect(css).not.toContain(".sidenav");
  });
});
