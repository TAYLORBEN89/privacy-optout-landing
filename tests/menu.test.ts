import { describe, expect, it } from "vitest";
import { nextMenuOpen } from "../src/menuState";

describe("hamburger menu", () => {
  it("toggles open and closed", () => {
    expect(nextMenuOpen(false, "toggle")).toBe(true);
    expect(nextMenuOpen(true, "toggle")).toBe(false);
  });

  it("closes on escape, navigate, and backdrop", () => {
    expect(nextMenuOpen(true, "escape")).toBe(false);
    expect(nextMenuOpen(true, "navigate")).toBe(false);
    expect(nextMenuOpen(true, "backdrop")).toBe(false);
  });
});
