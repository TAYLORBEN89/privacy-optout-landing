import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { helpFaqItems } from "../scripts/seo-render";
import { applyHead, SEO_PAGES } from "../shared/seo";
import {
  CONTENT_SECURITY_POLICY,
  STRICT_TRANSPORT_SECURITY,
  X_CONTENT_TYPE_OPTIONS,
  X_FRAME_OPTIONS,
} from "../worker/securityHeaders";

/**
 * Same documents scripts/prerender-seo.mjs writes: applyHead on every SEO page,
 * with helpFaqItems() only for /help. The script body is the JSON inside
 * jsonScript()'s application/ld+json tag.
 */
const SHELL = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
const JSON_LD = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

function sha256Base64(body: string): string {
  return createHash("sha256").update(body).digest("base64");
}

describe("CSP allows prerendered JSON-LD", () => {
  it("allows every JSON-LD script body the production build writes", () => {
    const faq = helpFaqItems();
    expect(faq.length).toBeGreaterThan(0);

    const documents = SEO_PAGES.map((page) => {
      const html = applyHead(SHELL, page, page.path === "/help" ? faq : []);
      const bodies = [...html.matchAll(JSON_LD)].map((match) => match[1]);
      return { path: page.path, bodies };
    });

    expect(documents).toHaveLength(26);
    const headersFile = readFileSync("public/_headers", "utf8");
    const cspLine = headersFile
      .split("\n")
      .find((line) => line.trimStart().startsWith("Content-Security-Policy:"));
    expect(cspLine).toBe(`  Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`);

    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-inline");
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(CONTENT_SECURITY_POLICY).not.toContain("script-src 'none'");
    expect(STRICT_TRANSPORT_SECURITY).toBe("max-age=31536000; includeSubDomains");
    expect(STRICT_TRANSPORT_SECURITY).not.toContain("preload");
    expect(X_FRAME_OPTIONS).toBe("DENY");
    expect(X_CONTENT_TYPE_OPTIONS).toBe("nosniff");

    const seen = new Set<string>();
    for (const document of documents) {
      expect(document.bodies, document.path).toHaveLength(1);
      const body = document.bodies[0];
      if (document.path === "/help") expect(body).toContain('"@type":"FAQPage"');
      const source = `'sha256-${sha256Base64(body)}'`;
      expect(CONTENT_SECURITY_POLICY, document.path).toContain(source);
      expect(cspLine, document.path).toContain(source);
      seen.add(source);
    }
    expect(seen.size).toBe(documents.length);
  });
});
