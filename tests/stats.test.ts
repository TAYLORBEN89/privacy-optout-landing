import { describe, expect, it } from "vitest";
import { BROKERS } from "../src/data/brokers";
import { buildStats, countAt, statText } from "../src/data/stats";

describe("stats", () => {
  it("counts brokers from the list and leaves uncited figures empty", () => {
    const stats = buildStats();
    expect(stats.find((stat) => stat.id === "brokers")?.value).toBe(BROKERS.length);
    for (const stat of stats.filter((item) => item.id !== "brokers")) {
      expect(stat.value).toBeNull();
      expect(stat.source.toLowerCase()).toContain("todo");
      expect(statText(stat.value)).toBe("Coming soon");
      expect(statText(stat.value)).not.toMatch(/\d/);
    }
  });

  it("finishes the count at the real target", () => {
    expect(countAt(0, 900, 9)).toBe(0);
    expect(countAt(900, 900, 9)).toBe(9);
    expect(countAt(450, 900, 9)).toBe(5);
  });
});
