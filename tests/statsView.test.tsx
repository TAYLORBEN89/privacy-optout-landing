/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Stats } from "../src/components/Stats";
import { visibleCitedStats } from "../src/data/stats";

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
  it("shows final verified values immediately when motion is reduced", () => {
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
    render(<Stats />);
    expect(observe).not.toHaveBeenCalled();
    const shown = visibleCitedStats().filter((stat) => stat.id !== "breach-cost");
    expect(shown.map((stat) => stat.id)).toEqual([
      "registered-brokers",
      "cyber-events",
      "account-breaches",
      "broker-market",
      "bid-requests",
    ]);
    for (const stat of shown) {
      const item = document.querySelector(`[data-stat='${stat.id}']`);
      expect(item?.querySelector(".stat-count")?.textContent).toBe(
        item?.querySelector(".visually-hidden")?.textContent,
      );
      const source = item?.querySelector("a");
      expect(source?.getAttribute("href")).toBe(stat.sourceUrl);
      expect(source?.getAttribute("target")).toBe("_blank");
      expect(source?.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(document.querySelector("[data-stat='optouts']")).toBeNull();
    expect(document.querySelector("[data-stat='breach-cost']")).toBeNull();
    expect(document.body.textContent).not.toContain("Coming soon");
    expect(document.body.textContent).not.toContain("Opt-outs filed");
    expect(document.body.textContent).not.toContain("average data breach cost");
    expect(document.body.textContent).not.toContain("5,650");
    expect(document.body.textContent).not.toContain("$4.44M");
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

    render(<Stats />);
    const hidden = document.querySelector("[data-stat='bid-requests'] .visually-hidden");
    const count = document.querySelector("[data-stat='bid-requests'] .stat-count");
    expect(hidden?.textContent).toBe("5.6M+");
    expect(count?.textContent).toBe("0.0M+");
    expect(count?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelectorAll(".stat-grid li")).toHaveLength(5);

    act(() => {
      onIntersect?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(disconnect).toHaveBeenCalled();
    expect(document.querySelector("[data-stat='bid-requests'] .stat-count")?.textContent).toBe("5.6M+");
    expect(document.querySelector("[data-stat='registered-brokers'] .stat-count")?.textContent).toBe("750+");
    expect(document.querySelector("[data-stat='cyber-events'] .stat-count")?.textContent).toBe("~2,514");
    expect(document.querySelector("[data-stat='account-breaches'] .stat-count")?.textContent).toBe("~810");
    expect(document.querySelector("[data-stat='broker-market'] .stat-count")?.textContent).toBe("~$307B");
    expect(document.querySelector("[data-stat='breach-cost']")).toBeNull();
    expect(document.querySelector("[data-stat='optouts']")).toBeNull();
  });

  it("sits directly after About Us on the blue band", () => {
    const page = readFileSync("src/pages/HomePage.tsx", "utf8");
    const values = page.indexOf("<ValuesSection");
    const stats = page.indexOf("<Stats");
    const how = page.indexOf('className="closing"');
    expect(values).toBeGreaterThan(-1);
    expect(values).toBeLessThan(stats);
    expect(stats).toBeLessThan(how);
    const css = readFileSync("src/styles.css", "utf8");
    const band = css.slice(css.indexOf(".stats {"), css.indexOf(".stats h2"));
    expect(band).toContain("background: #0b5cad");
    expect(css).toContain("grid-template-columns: repeat(6, minmax(0, 1fr))");
    expect(css).toContain("grid-column: 2 / span 2");
    expect(css).toContain("grid-column: 4 / span 2");
    expect(band).toContain("width: 100vw");
    const button = css.slice(css.indexOf(".stats-more {"), css.indexOf(".stats-more:hover"));
    expect(button).toContain("border: 1.5px solid #fff");
    expect(button).toContain("text-transform: uppercase");
  });
});
