/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RightsSection } from "../src/components/Rights";
import { TDPSA_POINTS, tdpsaRightCount } from "../src/data/rights";

const STATUTE = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm";

afterEach(() => {
  cleanup();
});

describe("your rights", () => {
  it("counts five access rights plus the appeal, and not the 45-day response", () => {
    expect(tdpsaRightCount()).toBe(6);
    expect(TDPSA_POINTS.filter((point) => point.consumerRight).map((point) => point.id)).toEqual([
      "access",
      "correct",
      "delete",
      "portable",
      "opt-out",
      "appeal",
    ]);
    expect(TDPSA_POINTS.find((point) => point.id === "response")?.consumerRight).toBe(false);
  });

  it("lists only verified TDPSA points and links to the statute", () => {
    render(<RightsSection />);
    expect(screen.getByRole("heading", { name: "Your rights under the TDPSA" })).toBeTruthy();
    expect(screen.getByText(/gives Texans rights over the personal data/)).toBeTruthy();
    const items = [...document.querySelectorAll(".rights-list li")].map((item) => item.textContent);
    expect(items).toEqual([
      "Confirm whether a company is processing your personal data and access that data.",
      "Correct inaccuracies in your personal data, taking into account the data and why it is used.",
      "Delete personal data provided by or obtained about you.",
      "If your data is in a digital format, get a portable copy of data you previously provided, when that is technically feasible.",
      "Opt out of the sale of personal data, targeted advertising, and profiling that furthers a legal or similarly significant decision.",
      "A company must respond within 45 days, and may extend that once by 45 days if it tells you why during the first 45 days.",
      "You can appeal a refusal to act on your request.",
      "A company may not discriminate against you for exercising these rights.",
      "The Texas Attorney General enforces this law.",
    ]);
    expect(document.querySelectorAll(".rights-check")).toHaveLength(9);
    expect(screen.getByText("This is a plain-English summary, not legal advice.")).toBeTruthy();
    const law = screen.getByRole("link", { name: "Read the full law >" });
    expect(law.getAttribute("href")).toBe(STATUTE);
    expect(law.getAttribute("target")).toBe("_blank");
    expect(law.getAttribute("rel")).toBe("noopener noreferrer");
    expect(document.querySelector("blockquote")).toBeNull();
  });

  it("cites a section number beside each bullet and follows the broker carousel", () => {
    const source = readFileSync("src/data/rights.ts", "utf8");
    const citations = [
      "541.051(b)(1)",
      "541.051(b)(2)",
      "541.051(b)(3)",
      "541.051(b)(4)",
      "541.051(b)(5)",
      "541.052(b)",
      "541.053(a)",
      "541.101(b)(3)",
      "541.151",
    ];
    let cursor = 0;
    for (const cite of citations) {
      const at = source.indexOf(cite, cursor);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(source).toContain("541.101(c)");
    expect(readFileSync("src/components/Rights.tsx", "utf8")).toContain("541.001(7)");
    const page = readFileSync("src/pages/HomePage.tsx", "utf8");
    const marquee = page.indexOf("<BrokerMarquee");
    const rights = page.indexOf("<RightsSection");
    const how = page.indexOf("<ValuesSection");
    expect(marquee).toBeGreaterThan(-1);
    expect(marquee).toBeLessThan(rights);
    expect(rights).toBeLessThan(how);
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("background: #f5f6f8");
    expect(css).toContain("width: min(560px, 100%)");
    const rule = css.slice(css.indexOf(".rights-law {"), css.indexOf(".rights-law:hover"));
    expect(rule).toContain("border: 1.5px solid #010101");
    expect(rule).toContain("text-transform: uppercase");
    const heading = css.slice(css.indexOf(".rights h2 {"), css.indexOf(".rights-body"));
    expect(heading).toContain("font-size: 40px");
    expect(heading).toContain("font-weight: 400");
    expect(css).toContain(".rights-body");
    expect(css.slice(css.indexOf(".rights-body {"), css.indexOf(".rights-list"))).toContain("font-size: 18px");
  });
});
