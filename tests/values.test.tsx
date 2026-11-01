/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ValuesSection } from "../src/components/Values";

afterEach(() => {
  cleanup();
});

describe("about us values", () => {
  it("lists the five values and links to the about page", () => {
    render(<ValuesSection />);
    expect(screen.getByText("About us").className).toContain("values-kicker");
    expect(screen.getByRole("heading", { name: "The values that drive DROP Texas" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Privacy is a right" })).toBeTruthy();
    expect(
      screen.getByText(
        "Your personal information belongs to you. We built DROP Texas so any Texan can tell data brokers to delete it and stop selling it.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("No fees, no upsells, no premium tier. Asking for your privacy shouldn't cost money."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "We collect just enough to send your requests: your name, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. Nothing more.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "We show where each request stands (Submitted, Pending, Confirmed, or No record found) and never claim a deletion we can't verify.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "DROP Texas is run by a private enterprise. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.",
      ),
    ).toBeTruthy();
    expect(document.querySelectorAll(".values-icon")).toHaveLength(5);
    expect(document.querySelector("img")).toBeNull();
    const more = screen.getByRole("link", { name: "More about us >" });
    expect(more.getAttribute("href")).toBe("/about");
  });

  it("follows Your Rights, drops the old more-about block, and uses the mosaic card", () => {
    const page = readFileSync("src/pages/HomePage.tsx", "utf8");
    const rights = page.indexOf("<RightsSection");
    const values = page.indexOf("<ValuesSection");
    const how = page.indexOf("<Stats");
    expect(rights).toBeGreaterThan(-1);
    expect(rights).toBeLessThan(values);
    expect(values).toBeLessThan(how);
    expect(page).not.toContain("more-about");
    expect(page).not.toContain("PeopleArt");
    const css = readFileSync("src/styles.css", "utf8");
    const mosaic = css.slice(css.indexOf(".values-mosaic {"), css.indexOf(".values-tile {"));
    expect(mosaic).toContain("height: 180px");
    const card = css.slice(css.indexOf(".values-card {"), css.indexOf(".values-kicker"));
    expect(card).toContain("margin: -80px auto 0");
    expect(card).toContain("border-radius: 16px");
    expect(card).toContain("width: min(720px, calc(100% - 32px))");
    const wide = css.slice(css.indexOf(".values-card {", css.indexOf("@media (min-width: 900px)")));
    expect(wide).toContain("width: min(1000px, calc(100% - 48px))");
    expect(wide).toContain("grid-template-columns: 1fr 1fr");
    const title = css.slice(css.indexOf(".values-list h3 {"), css.indexOf(".values-list p"));
    expect(title).toContain("font-size: 28px");
    expect(title).toContain("font-weight: 400");
    const body = css.slice(css.indexOf(".values-list p {"), css.indexOf(".values-more"));
    expect(body).toContain("font-size: 18px");
    expect(body).toContain("line-height: 1.6");
    const button = css.slice(css.indexOf(".values-more {"), css.indexOf(".values-more:hover"));
    expect(button).toContain("border: 1.5px solid #010101");
    expect(button).toContain("text-transform: uppercase");
  });
});
