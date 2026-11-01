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
      "If you provide a phone number, it is used only to find your records at data brokers and to fill in the opt-out, do-not-sell, and deletion requests sent to them. It is not used for marketing, calls, or texts, and it is not sold or shared except with the brokers as part of those requests.",
    );
    expect(html).not.toContain("match and locate");
    expect(html).toContain(
      "We keep what you give us only as long as your requests need it. Email help@droptexas.com to have it deleted at any time.",
    );
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

  it("pairs each section with its own icon", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    const items = html.split("<li>").slice(1);
    const expected = [
      ["collect", "Data we collect", "M8 7h8M8 12h8M8 17h5"],
      ["transit", "Encryption in transit", "M8 11V8a4 4 0 0 1 8 0v3"],
      ["rest", "Encryption at rest", "M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"],
      ["coming-soon", "Coming soon", "M12 8v4l3 2"],
      ["limits", "What we don&#x27;t do", "M8 12h8"],
      ["compliance", "Compliance", "M12 3.5 19 6.5v5c0 4-2.7 6.8-7 8.5-4.3-1.7-7-4.5-7-8.5v-5L12 3.5z"],
    ] as const;
    expect(items).toHaveLength(expected.length);
    for (const [index, [id, title, mark]] of expected.entries()) {
      expect(items[index]).toContain(`data-icon="${id}"`);
      expect(items[index]).toContain(title);
      expect(items[index]).toContain(mark);
    }
    expect(items[3]).toContain("<circle");
    expect(items[5]).not.toContain("M12 8v4l3 2");
    expect(items[3]).not.toContain("M12 3.5 19 6.5v5");
  });
});
