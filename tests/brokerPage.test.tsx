/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrokersPage } from "../src/pages/BrokersPage";
import { BROKERS } from "../src/data/brokers";
import { BROKER_PROFILES } from "../src/data/brokerProfiles";

afterEach(() => {
  cleanup();
});

describe("brokers page", () => {
  it("lists the nine carousel brokers and a source for each", () => {
    render(<BrokersPage />);
    expect(screen.getByRole("heading", { name: "Data brokers" })).toBeTruthy();
    const cards = document.querySelectorAll(".broker-card");
    expect(cards).toHaveLength(BROKERS.length);
    expect([...cards].map((card) => card.querySelector("h2")?.textContent)).toEqual([...BROKERS]);
    expect(BROKER_PROFILES.map((broker) => broker.name)).toEqual([...BROKERS]);
    for (const card of cards) {
      const link = card.querySelector("a");
      expect(link?.getAttribute("href")?.startsWith("https://")).toBe(true);
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
      expect(card.querySelectorAll("li").length).toBeGreaterThan(0);
    }
    expect(document.querySelector(".broker-card img")).toBeNull();
    expect(screen.getAllByText(/Accessed November 1, 2026/)).toHaveLength(BROKERS.length);
  });
});
