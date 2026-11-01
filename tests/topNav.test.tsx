/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TopNav } from "../src/components/TopNav";
import { NAV_ITEMS } from "../src/navItems";

afterEach(() => {
  cleanup();
});

describe("top navigation", () => {
  it("starts with the primary call to action and the eight section tiles", () => {
    render(<TopNav />);
    const nav = screen.getByRole("navigation", { name: "On this site" });
    const links = within(nav).getAllByRole("link");
    expect(links[0]?.textContent).toBe("Start Removing Me");
    expect(links[0]?.getAttribute("href")).toBe("/start");
    expect(links[0]?.className).toContain("cta");
    const tiles = links.slice(1);
    expect(tiles.map((link) => link.textContent)).toEqual(NAV_ITEMS.map((item) => item.label));
    expect(tiles.map((link) => link.getAttribute("href"))).toEqual(NAV_ITEMS.map((item) => item.href));
    expect(nav.querySelectorAll(".nav-tiles svg")).toHaveLength(8);
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  it("uses a single desktop row, a 4 by 2 grid when narrow, and a scrolling row on a phone", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("grid-template-columns: repeat(8, minmax(0, 1fr))");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(css).toMatch(/\.nav-tiles\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toContain(".nav-tiles a:focus-visible");
    expect(css).not.toContain(".sidenav");
    expect(css).not.toContain(".mobile-nav");
    expect(css).not.toContain(".menu-button");
  });
});
