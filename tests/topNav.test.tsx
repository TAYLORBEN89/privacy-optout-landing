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

describe("section tiles", () => {
  it("lists the eight sections with icons, blurbs, and the same anchors", () => {
    render(<TopNav />);
    const nav = screen.getByRole("navigation", { name: "On this site" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.querySelector(".tile-title")?.textContent)).toEqual(
      NAV_ITEMS.map((item) => item.label),
    );
    expect(links.map((link) => link.getAttribute("href"))).toEqual(NAV_ITEMS.map((item) => item.href));
    expect(nav.querySelectorAll(".nav-tiles svg.tile-chevron")).toHaveLength(8);
    expect(links[0]?.querySelector(".tile-blurb")?.textContent).toBeTruthy();
    expect(within(nav).queryByRole("link", { name: "Start Removing Me" })).toBeNull();
  });

  it("uses a desktop row, a 4 by 2 grid when narrower, and a vertical phone list", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("grid-template-columns: repeat(8, minmax(0, 1fr))");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(css).toContain("flex-direction: column");
    expect(css).toContain(".nav-tiles a:focus-visible");
    expect(css).not.toContain(".sidenav");
    expect(css).not.toContain(".mobile-nav");
    expect(css).not.toContain("overflow-x: auto");
  });
});
