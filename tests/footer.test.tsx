/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { DISCLAIMER } from "../src/copy";
import { SiteFooter } from "../src/Footer";
import { FOOTER_COPYRIGHT, FOOTER_DESKTOP_ROWS, FOOTER_GROUPS, TEXAS_STATUTE_URL } from "../src/footerLinks";

const ROUTES = new Set([
  "/overview",
  "/how-it-works",
  "/personal-information",
  "/data-brokers",
  "/unique-identifiers",
  "/tdpsa",
  "/brokers",
  "/about",
  "/share",
  "/help",
  "/start",
  "/privacy",
  "/security",
]);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
});

describe("site footer", () => {
  it("renders on the home page and on a subpage", () => {
    window.history.pushState({}, "", "/");
    const home = render(<App />);
    expect(home.getByRole("contentinfo")).toBeTruthy();
    expect(home.getByText("Ready to take back your privacy?")).toBeTruthy();
    home.unmount();

    window.history.pushState({}, "", "/privacy");
    const sub = render(<App />);
    expect(sub.getByRole("heading", { name: "Privacy & Security" })).toBeTruthy();
    expect(sub.getByRole("contentinfo")).toBeTruthy();
  });

  it("toggles each accordion and links only to real routes", async () => {
    const user = userEvent.setup();
    render(<SiteFooter />);
    expect(screen.getByText(DISCLAIMER)).toBeTruthy();
    expect(screen.getByText(FOOTER_COPYRIGHT)).toBeTruthy();
    expect(document.querySelector(".footer-dock")).toBeNull();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();

    for (const group of FOOTER_GROUPS) {
      const button = screen.getByRole("button", { name: group.title });
      expect(button.getAttribute("aria-expanded")).toBe("false");
      await user.click(button);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
      expect(panel?.hidden).toBe(false);
      await user.click(button);
      expect(button.getAttribute("aria-expanded")).toBe("false");
    }

    const links = [...document.querySelectorAll(".site-footer a")];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("/")) expect(ROUTES.has(href)).toBe(true);
      else expect(href).toBe(TEXAS_STATUTE_URL);
    }
    expect(FOOTER_DESKTOP_ROWS.flat().every((link) => ROUTES.has(link.href))).toBe(true);
  });

  it("uses flat solid colors", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const footer = css.slice(css.indexOf(".site-footer {"), css.indexOf(".text-link"));
    expect(footer).toContain("background: #f5f6f8");
    expect(footer).toContain("background: #0c1220");
    expect(footer).not.toContain("linear-gradient");
    expect(footer).not.toContain("radial-gradient");
  });
});
