/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { TEXAS_PROPOSAL_MISSION } from "../src/copy";
import { Header } from "../src/Header";
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

describe("Texas Proposal header link", () => {
  it("links the header to /texas-proposal and keeps the account link", () => {
    render(<Header signedIn={false} csrf={null} onSignedOut={() => undefined} />);
    const links = screen.getAllByRole("link", { name: "Texas Proposal" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("href")).toBe("/texas-proposal");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/signin");
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(".proposal-link:focus-visible");
    expect(css).toContain("outline: 3px solid var(--blue)");
  });

  it("opens the mobile menu so the Texas Proposal link is visible and reachable", async () => {
    const user = userEvent.setup();
    render(<Header signedIn={false} csrf={null} onSignedOut={() => undefined} />);
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Texas Proposal" })).toHaveLength(1);

    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const links = screen.getAllByRole("link", { name: "Texas Proposal" });
    const mobile = links.find((link) => link.closest(".proposal-menu-panel"));
    expect(mobile?.getAttribute("href")).toBe("/texas-proposal");
    expect(mobile?.hidden).toBe(false);
    await user.click(mobile!);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getAllByRole("link", { name: "Texas Proposal" })).toHaveLength(1);

    await user.click(button);
    await user.keyboard("{Escape}");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/signin");
  });

  it("marks the proposal link as the current page", () => {
    render(<Header signedIn={false} csrf={null} path="/texas-proposal" onSignedOut={() => undefined} />);
    expect(screen.getByRole("link", { name: "Texas Proposal" }).getAttribute("aria-current")).toBe("page");
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
