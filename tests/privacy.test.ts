import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PrivacyPage } from "../src/pages/PrivacyPage";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("privacy page", () => {
  it("returns the privacy sections without a certification or California claim", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("Privacy &amp; Security");
    expect(html).toContain("Data we collect");
    expect(html).toContain("Encryption in transit");
    expect(html).toContain("Encryption at rest");
    expect(html).toContain("Cloudflare D1");
    expect(html).toContain("built to SOC 2 standards");
    expect(html).not.toMatch(/certified/i);
    expect(html).not.toMatch(/CalPrivacy|State of California/);
    expect(html).not.toMatch(/Strict-Transport-Security|HSTS/i);
    expect(html).toContain("independent, free service");
    expect(html).toContain("privacy-page");
    const css = readFileSync("src/styles.css", "utf8");
    const rule = css.slice(css.indexOf(".privacy-page {"), css.indexOf(".privacy-list"));
    expect(rule).toContain("margin-top: 40px");
    const wide = css.slice(css.indexOf(".privacy-page {", css.indexOf("@media (min-width: 900px)")));
    expect(wide).toContain("margin-top: 64px");
    expect(readFileSync("src/pages/AboutPage.tsx", "utf8")).not.toContain("privacy-page");
    expect(readFileSync("src/pages/SecurityPage.tsx", "utf8")).not.toContain("privacy-page");
  });

  it("keeps the review note in the source and out of the page", () => {
    const source = readFileSync("src/pages/PrivacyPage.tsx", "utf8");
    expect(source).toContain("Cybersecurity and Compliance Agents must review this copy");
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).not.toContain("Cybersecurity and Compliance Agents");
  });
});
