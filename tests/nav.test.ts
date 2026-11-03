import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "../src/navItems";

describe("site nav", () => {
  it("lists the eight DROP sections in order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Overview",
      "How It Works",
      "Personal Information",
      "Data Brokers",
      "Unique Identifiers",
      "TDPSA",
      "Help",
      "Share",
    ]);
  });

  it("does not mention a delete act", () => {
    const labels = NAV_ITEMS.map((item) => item.label).join(" ");
    expect(labels).not.toMatch(/DELETE Act/i);
    expect(labels).toContain("TDPSA");
  });
});
