import { describe, expect, it } from "vitest";
import { CITED_STATS, SECONDS_PER_COMMON_YEAR, countAt, formatStat, visibleCitedStats } from "../src/data/stats";

describe("stats", () => {
  it("renders only verified stats and gives each one a source URL", () => {
    const shown = visibleCitedStats();
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((stat) => stat.verified)).toBe(true);
    expect(shown.every((stat) => stat.sourceUrl.startsWith("https://"))).toBe(true);
    expect(CITED_STATS.filter((stat) => !stat.verified).every((stat) => !shown.includes(stat))).toBe(true);
    expect(shown.map((stat) => stat.id)).toEqual([
      "registered-brokers",
      "cyber-events",
      "account-breaches",
      "broker-market",
      "breach-cost",
      "bid-requests",
    ]);
    const rejected = visibleCitedStats([
      { ...shown[0], id: "unverified", verified: false },
      { ...shown[0], id: "unsourced", sourceUrl: "" },
    ]);
    expect(rejected).toEqual([]);
    expect(formatStat(750, "", "+", 0)).toBe("750+");
    expect(formatStat(2514, "~", "", 0)).toBe("~2,514");
    expect(formatStat(810, "~", "", 0)).toBe("~810");
    expect(formatStat(307, "~$", "B", 0)).toBe("~$307B");
    expect(formatStat(4.99, "$", "M", 2)).toBe("$4.99M");
    expect(formatStat(5.6, "", "M+", 1)).toBe("5.6M+");
  });

  it("matches the published yearly totals after dividing by a common year", () => {
    expect(79.3e9 / SECONDS_PER_COMMON_YEAR).toBeCloseTo(2514.6, 0);
    expect(425.7e6 / (365 * 24 * 60)).toBeCloseTo(810, 0);
    const bidsPerSecond = 178e12 / SECONDS_PER_COMMON_YEAR;
    expect(bidsPerSecond / 1e6).toBeCloseTo(5.64, 2);
    expect(bidsPerSecond).toBeGreaterThan(5_000_000);
    expect(bidsPerSecond).not.toBeCloseTo(5650, -2);
  });

  it("eases out, keeps decimals, and finishes on the real target", () => {
    expect(countAt(0, 1500, 9)).toBe(0);
    expect(countAt(1500, 1500, 9)).toBe(9);
    expect(countAt(2000, 1500, 9)).toBe(9);
    expect(countAt(750, 1500, 9)).toBeGreaterThan(5);
    expect(countAt(750, 1500, 0)).toBe(0);
    expect(countAt(1500, 1500, 5.6, 1)).toBe(5.6);
    expect(countAt(0, 1500, 4.99, 2)).toBe(0);
    expect(countAt(1500, 1500, 4.99, 2)).toBe(4.99);
  });
});
