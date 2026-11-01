import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BROKERS } from "../src/data/brokers";
import { TDPSA_RESPONSE_DAYS, tdpsaRightCount } from "../src/data/rights";
import { buildStats, countAt, statText } from "../src/data/stats";

describe("stats", () => {
  it("uses the broker list, the statute figures, and leaves opt-outs uncounted", () => {
    const stats = buildStats();
    expect(stats.find((stat) => stat.id === "brokers")?.value).toBe(BROKERS.length);
    expect(stats.find((stat) => stat.id === "brokers")?.label).toBe("Data brokers covered");
    expect(stats.find((stat) => stat.id === "cost")).toMatchObject({ value: 0, prefix: "$", label: "Cost to Texans" });
    expect(statText(0, "$")).toBe("$0");
    expect(stats.find((stat) => stat.id === "response-days")?.value).toBe(TDPSA_RESPONSE_DAYS);
    expect(stats.find((stat) => stat.id === "rights")?.value).toBe(tdpsaRightCount());
    const optouts = stats.find((stat) => stat.id === "optouts");
    expect(optouts?.label).toBe("Opt-outs filed");
    expect(optouts?.value).toBeNull();
    expect(statText(optouts?.value ?? null)).toBe("Coming soon");
    expect(stats.map((stat) => stat.id)).not.toContain("sold-per-second");
    expect(stats.map((stat) => stat.id)).not.toContain("people-in-files");

    const source = readFileSync("src/data/stats.ts", "utf8");
    expect(source).toContain("BROKERS.length");
    expect(source).toContain("TDPSA_RESPONSE_DAYS");
    expect(source).toContain("tdpsaRightCount()");
    expect(source).not.toMatch(/value:\s*45/);
    expect(source).not.toMatch(/value:\s*\d{2,}/);
    const view = readFileSync("src/components/Stats.tsx", "utf8");
    expect(view).not.toMatch(/\bComing soon\b.*\d{2,}/);
    expect(view).not.toContain("value: 9");
  });

  it("eases out and finishes on the real target", () => {
    expect(countAt(0, 1500, 9)).toBe(0);
    expect(countAt(1500, 1500, 9)).toBe(9);
    expect(countAt(2000, 1500, 9)).toBe(9);
    expect(countAt(750, 1500, 9)).toBeGreaterThan(5);
    expect(countAt(750, 1500, 0)).toBe(0);
  });
});
