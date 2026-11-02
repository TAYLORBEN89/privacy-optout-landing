import { describe, expect, it } from "vitest";
import { REGISTRY_BROKERS } from "../src/data/registryBrokers";
import { REGISTRY_GROUPS } from "../src/data/registryGroups";

describe("registry dashboard foundation", () => {
  it("places every Texas filing in one process group", () => {
    expect(REGISTRY_BROKERS).toHaveLength(456);
    const ids = new Set(REGISTRY_GROUPS.map((group) => group.id));
    const counts = new Map<string, number>();
    for (const broker of REGISTRY_BROKERS) {
      expect(ids.has(broker.group)).toBe(true);
      counts.set(broker.group, (counts.get(broker.group) ?? 0) + 1);
      if (broker.url) expect(/^https?:\/\//.test(broker.url)).toBe(true);
    }
    expect(counts.get("portal")).toBe(18);
    expect(counts.get("opt-out-page")).toBe(69);
    expect(counts.get("privacy-page")).toBe(284);
    expect(counts.get("other-page")).toBe(63);
    expect(counts.get("email")).toBe(2);
    expect(counts.get("no-link")).toBe(20);
    const agr = REGISTRY_BROKERS.find((broker) => broker.name === "AGR Marketing Solutions LLC");
    expect(agr?.optOutEmail).toBe("info@agrmarketingsolutions.com");
    const steps = REGISTRY_GROUPS.map((group) => group.steps).join("\n").toLowerCase();
    expect(steps).not.toContain("verified");
    expect(steps).not.toContain("confirmed");
  });
});
