/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeaturePanel } from "../src/components/FeaturePanel";
import { TopNav } from "../src/components/TopNav";
import {
  DataBrokersPage,
  HelpPage,
  HowItWorksPage,
  OverviewPage,
  PersonalInformationPage,
  SharePage,
  TdpsaPage,
  UniqueIdentifiersPage,
} from "../src/pages/topics";

const PAGES = [
  ["/overview", "Overview", OverviewPage],
  ["/how-it-works", "How DROP works", HowItWorksPage],
  ["/personal-information", "Personal information", PersonalInformationPage],
  ["/data-brokers", "Data brokers", DataBrokersPage],
  ["/unique-identifiers", "Unique identifiers", UniqueIdentifiersPage],
  ["/tdpsa", "The Texas Data Privacy and Security Act", TdpsaPage],
  ["/help", "Help", HelpPage],
  ["/share", "Share DROP Texas", SharePage],
] as const;

afterEach(() => {
  cleanup();
});

describe("explore pages", () => {
  it("renders a heading and a start link on every page", () => {
    for (const [, heading, Page] of PAGES) {
      cleanup();
      render(<Page />);
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Start my opt-out" }).getAttribute("href")).toBe("/start");
      expect(document.body.textContent).not.toMatch(/verified deletion|certified/i);
    }
  });

  it("points each explore tile at its page", () => {
    render(<TopNav />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(PAGES.map(([path]) => path));
  });

  it("points the feature cards at the same pages", () => {
    render(<FeaturePanel />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs.slice(0, 6)).toEqual([
      "/overview",
      "/how-it-works",
      "/personal-information",
      "/data-brokers",
      "/unique-identifiers",
      "/tdpsa",
    ]);
  });

  it("links data brokers to the broker list and personal information to privacy", () => {
    render(<DataBrokersPage />);
    expect(screen.getByRole("link", { name: "brokers page" }).getAttribute("href")).toBe("/brokers");
    cleanup();
    render(<PersonalInformationPage />);
    expect(screen.getByRole("link", { name: "How we protect it" }).getAttribute("href")).toBe("/privacy");
  });

  it("shares with plain links and does not publish a support email", () => {
    render(<SharePage />);
    expect(screen.getByRole("link", { name: "Email" }).getAttribute("href")).toMatch(/^mailto:\?/);
    expect(screen.getByRole("link", { name: "Share on X" }).getAttribute("href")).toMatch(
      /^https:\/\/twitter\.com\/intent\/tweet\?/,
    );
    expect(screen.getByRole("link", { name: "Share on Facebook" }).getAttribute("href")).toMatch(
      /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/,
    );
    const help = readFileSync("src/pages/topics.tsx", "utf8");
    expect(help).toContain("TODO: no support email is configured");
    cleanup();
    render(<HelpPage />);
    expect(document.body.textContent).not.toMatch(/@/);
  });
});
