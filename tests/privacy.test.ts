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
    expect(html).toContain("DROP Texas is built to SOC 2 standards. Not audited, not certified.");
    expect(html).not.toMatch(/SOC 2 certified|is certified/i);
    expect(html).not.toMatch(/CalPrivacy|State of California/);
    expect(html).not.toMatch(/Strict-Transport-Security|HSTS/i);
    expect(html).toContain("independent, free service");
    expect(html).toContain(
      "used only to match and locate your records to find your records at data brokers and to fill in the opt-out, do-not-sell, and deletion requests sent to them",
    );
    expect(html).toContain("not used for marketing, calls, or texts");
    expect(html).toContain("We keep it only as long as your requests need it. Email help@droptexas.com to have it deleted at any time.");
    expect(html).toContain("Every page and API call is served over HTTPS (TLS 1.2 or newer) through Cloudflare.");
    expect(html).toContain("Saved information is stored in Cloudflare D1 and Workers KV, which Cloudflare encrypts at rest (AES-256).");
    expect(html).toContain("Coming soon");
    expect(html).toContain(
      "Sign in with Google or Microsoft, secure session cookies, and self-service export and delete. Until then, email help@droptexas.com to see or delete your data.",
    );
    expect(html).not.toContain("Secure sign-in");
    expect(html).not.toContain("Your controls");
    expect(html).not.toContain("sign out of other sessions");
    expect(html).not.toContain("on your behalf");
    expect(html).toContain("the server checks them again");
    expect(html).not.toMatch(/\d+\s+days/);
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
    expect(source).toContain("TODO(retention): no concrete retention period");
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).not.toContain("Cybersecurity and Compliance Agents");
  });
});
