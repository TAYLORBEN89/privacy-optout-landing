/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Stats } from "../src/components/Stats";
import { buildStats } from "../src/data/stats";

afterEach(() => {
  cleanup();
});

describe("stats rendering", () => {
  it("shows Coming soon for null values and the real broker count", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as typeof window.matchMedia;
    render(<Stats stats={buildStats(9)} />);
    expect(screen.getAllByText("Coming soon").length).toBe(3);
    expect(await screen.findByText("9")).toBeTruthy();
    const sold = document.querySelector("[data-stat='sold-per-second']");
    expect(sold?.textContent).toContain("Coming soon");
    expect(sold?.textContent).not.toMatch(/\d/);
  });
});