/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { Header } from "../src/Header";
import { FOOTER_DESKTOP_ROWS, FOOTER_GROUPS } from "../src/footerLinks";
import { ForBrokersPage, STARTER_KIT_URL } from "../src/pages/ForBrokersPage";
import { TexasProposalPage } from "../src/pages/TexasProposalPage";
import { routePage } from "../src/routePage";
import { canonicalFor, pageByPath, sitemapXml } from "../shared/seo";

afterEach(() => cleanup());

const ctx = { getStartedHref: "/start", action: "form" as const, csrfToken: null, me: null };
const text = () => document.body.textContent ?? "";

describe("/for-brokers", () => {
  it("renders at /for-brokers with one h1, and /brokers is still the broker list", () => {
    render(routePage("/for-brokers", ctx));
    expect(screen.getByRole("heading", { level: 1, name: "For Data Brokers" })).toBeTruthy();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(renderToStaticMarkup(routePage("/brokers", ctx))).not.toContain("For Data Brokers");
  });

  it("is in the SEO catalog and the sitemap", () => {
    expect(pageByPath("/for-brokers")?.indexable).toBe(true);
    expect(sitemapXml()).toContain(canonicalFor("/for-brokers"));
  });

  it("reuses the Texas Proposal hash steps word for word", () => {
    render(<ForBrokersPage />);
    const ours = document.querySelector("ol.hash-flow")?.textContent;
    cleanup();
    render(<TexasProposalPage />);
    expect(document.querySelector("ol.hash-flow")?.textContent).toBe(ours);
    expect(ours).toContain("Hash with SHA-256");
  });

  it("makes no banned claims", () => {
    render(<ForBrokersPage />);
    const body = text().toLowerCase();
    for (const banned of ["we delete", "verified deletion", "we send", "we verify", "apple", "soc 2 certified", "soc 2 compliant", "encrypted at rest"]) {
      expect(body, banned).not.toContain(banned);
    }
    expect(body).not.toMatch(/\b\d{3,}\s+(registered\s+)?(data\s+)?brokers\b/);
    expect(body).toContain("hundreds of registered data brokers");
    expect(body).toContain("each with its own 45-day response window");
    expect(body).toContain("does not send requests for people");
  });

  it("uses only the approved SOC 2 wording", () => {
    render(<ForBrokersPage />);
    const mentions = text().match(/SOC 2[^.]*/g) ?? [];
    expect(mentions).toEqual(["SOC 2 standards"]);
    expect(text()).toContain("DROP Texas is built to SOC 2 standards.");
  });

  it("links the starter kit to a marked placeholder, not a repo", () => {
    render(<ForBrokersPage />);
    expect(STARTER_KIT_URL).toBe("#starter-kit-coming-soon");
    const link = screen.getByRole("link", { name: "Starter kit (not published yet)" });
    expect(link.getAttribute("href")).toBe(STARTER_KIT_URL);
    expect(document.querySelector('a[href*="github.com"]')).toBeNull();
  });

  it("leaves the header unchanged: logo and account icon only, no link to the page", () => {
    render(<Header signedIn={false} csrf={null} onSignedOut={() => undefined} />);
    const hrefs = [...document.querySelectorAll("header a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/signin?return_to=%2Faccount"]);
    expect(readFileSync("src/Header.tsx", "utf8")).not.toContain("for-brokers");
  });

  it("is linked from /texas-proposal and the footer", () => {
    render(<TexasProposalPage />);
    const link = screen.getByRole("link", { name: "For Data Brokers page" });
    expect(link.getAttribute("href")).toBe("/for-brokers");
    expect(link.closest("p")?.textContent).toBe("Data brokers can read more on the For Data Brokers page.");
    expect(link.closest("section")?.querySelector("h2")?.textContent).toBe("What DROP Texas plans to offer");
    const footer = [...FOOTER_GROUPS.flatMap((g) => g.links), ...FOOTER_DESKTOP_ROWS.flat()].filter((l) => l.href === "/for-brokers");
    expect(footer.map((l) => l.label)).toEqual(["For Data Brokers", "For Data Brokers"]);
  });
});
