/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrokerMarquee } from "../src/components/Marquee";
import { BROKERS } from "../src/data/brokers";

afterEach(() => {
  cleanup();
});

describe("broker marquee", () => {
  it("shows only the registry names as text and links to the broker section", () => {
    render(<BrokerMarquee />);
    const label = screen.getByRole("heading", { name: "Brokers we opt you out from" });
    expect(label.className).toContain("marquee-label");
    const visible = [...document.querySelectorAll(".broker-name:not([data-clone])")].map((item) => item.textContent);
    expect(visible).toEqual([...BROKERS]);
    expect(document.querySelector(".chip")).toBeNull();
    const more = screen.getByRole("link", { name: "See all brokers >" });
    expect(more.getAttribute("href")).toBe("/#data-brokers");
  });

  it("fades both sides, scrolls, and pauses for hover and reduced motion", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("mask-image: linear-gradient(to right, transparent 0, #000 15%, #000 85%, transparent 100%)");
    expect(css).toContain("font-size: 26px");
    expect(css).toContain("font-size: 32px");
    expect(css).toContain("animation-play-state: paused");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".marquee-track");
    expect(reduced).toContain("animation: none");
    expect(reduced).not.toContain("flex-wrap: wrap");
    const rule = css.slice(css.indexOf(".marquee-section {"), css.indexOf(".marquee-label"));
    expect(rule).toContain("width: 100vw");
    expect(rule).toContain("margin-left: calc(50% - 50vw)");
    expect(rule).toContain("margin-right: calc(50% - 50vw)");
    expect(css).not.toContain(".content .marquee-section");
  });
});
