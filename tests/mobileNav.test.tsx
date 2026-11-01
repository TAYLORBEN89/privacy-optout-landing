/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MobileNav } from "../src/components/MobileNav";
import { Header } from "../src/Header";
import { NAV_ITEMS } from "../src/navItems";
import { signInHrefFor } from "../src/authGate";

afterEach(() => {
  cleanup();
});

describe("mobile section links", () => {
  it("renders the eight nav items in a landmark with no chrome", () => {
    render(<MobileNav />);
    const nav = screen.getByRole("navigation", { name: "On this site" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(NAV_ITEMS.map((item) => item.label));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(NAV_ITEMS.map((item) => item.href));
    expect(nav.querySelector(".mobile-nav-track")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("scrolls the row, fades the right edge, and shows a focus ring", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const track = css.slice(css.indexOf(".mobile-nav-track {"), css.indexOf(".mobile-nav-track::-webkit-scrollbar"));
    expect(track).toContain("overflow-x: auto");
    expect(track).not.toContain("border:");
    expect(css).toContain("linear-gradient(90deg, rgba(248, 249, 251, 0), var(--bg))");
    expect(css).toContain(".mobile-nav a:focus-visible");
    expect(css).not.toContain(".menu-button");
    expect(css).not.toContain(".drawer");
  });

  it("does not put a hamburger in the header", () => {
    render(
      <Header signedIn={false} csrf={null} signInHref={signInHrefFor("/start")} accountsLive={false} onSignedOut={() => undefined} />,
    );
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
