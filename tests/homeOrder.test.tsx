/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomePage } from "../src/pages/HomePage";

afterEach(() => {
  cleanup();
});

describe("homepage after the stats band", () => {
  it("puts the closing call to action directly after the stats band", () => {
    render(<HomePage getStartedHref="/start" />);
    const stats = document.querySelector(".stats");
    const closing = document.querySelector(".closing");
    expect(stats).toBeTruthy();
    expect(closing).toBeTruthy();
    expect(stats?.nextElementSibling).toBe(closing);
    expect(screen.getByRole("heading", { name: "Ready to take back your privacy?" })).toBeTruthy();
    expect(closing?.querySelector("a")?.getAttribute("href")).toBe("/start");
    expect(screen.getByRole("link", { name: "More about DROP Texas >" }).getAttribute("href")).toBe("/about");
    expect(document.getElementById("how-drop-works")).toBeNull();
    expect(document.getElementById("data-brokers")).toBeNull();
    expect(document.getElementById("unique-identifiers")).toBeNull();
    expect(document.getElementById("tdpsa")).toBeNull();
    expect(document.getElementById("help")).toBeNull();
    expect(document.getElementById("share")).toBeNull();
  });
});
