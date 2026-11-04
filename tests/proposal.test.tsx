/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { TEXAS_PROPOSAL_MISSION } from "../src/copy";
import { Header } from "../src/Header";
import { HomePage } from "../src/pages/HomePage";
import { TexasProposalPage } from "../src/pages/TexasProposalPage";
import { canonicalFor, pageByPath } from "../shared/seo";

afterEach(() => {
  cleanup();
});

describe("Texas Proposal page", () => {
  it("opens with the mission and puts hashing second", () => {
    render(<TexasProposalPage />);
    const article = screen.getByRole("article");
    const sections = [...article.querySelectorAll("section")];
    expect(sections[0]?.className).toContain("proposal-mission");
    expect(sections[0]?.textContent).toContain(TEXAS_PROPOSAL_MISSION);
    expect(sections[1]?.querySelector("h2")?.textContent).toBe("How the hash system works");
    expect(screen.getByRole("heading", { level: 1, name: "The Texas Proposal" })).toBeTruthy();
  });

  it("uses the pull quote once, inside the mission", () => {
    render(<TexasProposalPage />);
    const text = document.body.textContent ?? "";
    const quote = "a right you can't enforce isn't a right at all";
    expect(text.toLowerCase().split(quote).length - 1).toBe(1);
    expect(text.split("We mean to change that.").length - 1).toBe(1);
    expect(screen.getByText("a right you can't enforce isn't a right at all").tagName).toBe("Q");
    expect(TEXAS_PROPOSAL_MISSION).not.toMatch(/impossible/i);
    expect(text).toContain("Our goal: one free request that reaches every registered data broker, for 100% of Texans.");
  });

  it("keeps the private-enterprise disclaimer and the source links", () => {
    render(<TexasProposalPage />);
    expect(screen.getByText(/private enterprise/)).toBeTruthy();
    expect(screen.getByText(/not affiliated with the State of Texas/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "technical guide" }).getAttribute("href")).toContain(
      "privacy.ca.gov/drop-for-data-brokers/technical-specifications/working-with-data",
    );
    expect(screen.getByRole("link", { name: "data broker regulation" }).getAttribute("href")).toContain(
      "cppa.ca.gov/regulations/pdf/data_broker_drop_reg.pdf",
    );
    expect(screen.getByRole("link", { name: "Business and Commerce Code chapter 541" }).getAttribute("href")).toContain(
      "BC.541.htm",
    );
    expect(screen.getByRole("link", { name: "Business and Commerce Code chapter 510" }).getAttribute("href")).toContain(
      "BC.510.htm",
    );
    expect(document.body.textContent).toContain("help@droptexas.com");
    expect(document.body.textContent).not.toMatch(/individual/i);
  });
});

describe("Header and hero links", () => {
  it("header has only the brand and the account icon: no Texas Proposal link, no Menu button", () => {
    render(<Header signedIn={false} csrf={null} onSignedOut={() => undefined} />);
    expect(screen.queryByRole("link", { name: "Texas Proposal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(document.querySelector(".proposal-menu-panel")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/signin");
    expect(document.querySelector("a.account-button")).toBeTruthy();
  });

  it("homepage hero uses the decorative hills picture with high fetch priority", () => {
    render(<HomePage getStartedHref="/start" />);
    const hero = document.querySelector("section.hero.hero--hills") as HTMLElement;
    const picture = hero.querySelector("picture.hero-bg");
    expect(picture?.getAttribute("aria-hidden")).toBe("true");
    expect(picture?.querySelectorAll('source[type="image/webp"]').length).toBe(2);
    const img = picture?.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("width")).toBe("1920");
    expect(img?.getAttribute("height")).toBe("640");
    expect(img?.getAttribute("fetchpriority")).toBe("high");
    expect(within(hero).getByRole("link", { name: /Start my opt-out/i })).toBeTruthy();
  });

  it("homepage hero links to /texas-proposal below the primary CTA", () => {
    render(<HomePage getStartedHref="/start" />);
    const hero = document.querySelector("section.hero") as HTMLElement;
    const link = within(hero).getByRole("link", { name: "Read the Texas Proposal" });
    expect(link.getAttribute("href")).toBe("/texas-proposal");
    expect(link.className).not.toContain("cta");
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(".hero-proposal-link:focus-visible");
  });
});

describe("Texas Proposal SEO", () => {
  it("is indexable with a canonical on droptexas.com", () => {
    const page = pageByPath("/texas-proposal");
    expect(page?.indexable).toBe(true);
    expect(page?.title).toContain("Texas Proposal");
    expect(canonicalFor("/texas-proposal")).toBe("https://droptexas.com/texas-proposal");
  });
});
