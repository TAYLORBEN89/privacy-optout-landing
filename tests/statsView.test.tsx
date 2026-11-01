/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Stats } from "../src/components/Stats";
import { BROKERS } from "../src/data/brokers";
import { TDPSA_RESPONSE_DAYS, tdpsaRightCount } from "../src/data/rights";
import { buildStats } from "../src/data/stats";

function matchMedia(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stats rendering", () => {
  it("shows final values immediately when motion is reduced", () => {
    matchMedia(true);
    const observe = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = observe;
        disconnect() {}
        unobserve() {}
      },
    );
    render(<Stats stats={buildStats()} />);
    expect(observe).not.toHaveBeenCalled();
    expect(document.querySelector("[data-stat='brokers'] .stat-count")?.textContent).toBe(String(BROKERS.length));
    expect(document.querySelector("[data-stat='cost'] .stat-count")?.textContent).toBe("$0");
    expect(document.querySelector("[data-stat='response-days'] .stat-count")?.textContent).toBe(String(TDPSA_RESPONSE_DAYS));
    expect(document.querySelector("[data-stat='rights'] .stat-count")?.textContent).toBe(String(tdpsaRightCount()));
    expect(document.querySelector("[data-stat='optouts'] .stat-value")?.textContent).toBe("Coming soon");
    expect(screen.getByRole("link", { name: "More about DROP Texas >" }).getAttribute("href")).toBe("/about");
  });

  it("keeps the real value in the HTML and counts up once the section intersects", () => {
    matchMedia(false);
    let onIntersect: IntersectionObserverCallback | null = null;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          onIntersect = callback;
        }
        observe() {}
        disconnect = disconnect;
        unobserve() {}
      },
    );
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      now += 800;
      callback(now);
      return 1;
    });

    render(<Stats stats={buildStats()} />);
    const count = document.querySelector("[data-stat='brokers'] .stat-count");
    const hidden = document.querySelector("[data-stat='brokers'] .visually-hidden");
    expect(count?.textContent).toBe("0");
    expect(hidden?.textContent).toBe(String(BROKERS.length));
    expect(count?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector("[data-stat='optouts'] .stat-count")).toBeNull();

    act(() => {
      onIntersect?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(disconnect).toHaveBeenCalled();
    expect(document.querySelector("[data-stat='brokers'] .stat-count")?.textContent).toBe(String(BROKERS.length));
    expect(document.querySelector("[data-stat='response-days'] .stat-count")?.textContent).toBe(String(TDPSA_RESPONSE_DAYS));
    expect(document.querySelector("[data-stat='rights'] .stat-count")?.textContent).toBe(String(tdpsaRightCount()));
    expect(document.querySelector("[data-stat='cost'] .stat-count")?.textContent).toBe("$0");
    expect(document.querySelector("[data-stat='optouts']")?.textContent).toContain("Coming soon");
    expect(document.querySelector("[data-stat='optouts']")?.textContent).not.toMatch(/\d/);
  });

  it("sits directly after About Us on the blue band", () => {
    const page = readFileSync("src/pages/HomePage.tsx", "utf8");
    const values = page.indexOf("<ValuesSection");
    const stats = page.indexOf("<Stats");
    const how = page.indexOf('id="how-drop-works"');
    expect(values).toBeGreaterThan(-1);
    expect(values).toBeLessThan(stats);
    expect(stats).toBeLessThan(how);
    const css = readFileSync("src/styles.css", "utf8");
    const band = css.slice(css.indexOf(".stats {"), css.indexOf(".stats h2"));
    expect(band).toContain("background: #0b5cad");
    expect(band).toContain("width: 100vw");
    const button = css.slice(css.indexOf(".stats-more {"), css.indexOf(".stats-more:hover"));
    expect(button).toContain("border: 1.5px solid #fff");
    expect(button).toContain("text-transform: uppercase");
    const wide = css.slice(css.indexOf(".stat-grid {", css.indexOf("@media (min-width: 900px)")));
    expect(wide).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
  });
});
