/**
 * @vitest-environment happy-dom
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalFor, indexablePages, SEO_PAGES, sitemapXml } from "../shared/seo";
import { routePage } from "../src/routePage";

describe("seo catalog", () => {
  it("keeps titles, descriptions, and focus keyphrases unique and in range", () => {
    const titles = SEO_PAGES.map((page) => page.title);
    const descriptions = SEO_PAGES.map((page) => page.description);
    const focuses = SEO_PAGES.map((page) => page.focus.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(new Set(focuses).size).toBe(focuses.length);
    for (const page of SEO_PAGES) {
      expect(page.title.length, page.path).toBeGreaterThanOrEqual(50);
      expect(page.title.length, page.path).toBeLessThanOrEqual(60);
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(140);
      expect(page.description.length, page.path).toBeLessThanOrEqual(156);
      expect(page.title.toLowerCase(), page.path).toContain(page.focus.toLowerCase());
      expect(page.description.toLowerCase(), page.path).toContain(page.focus.toLowerCase());
      expect(page.related.length, page.path).toBeGreaterThanOrEqual(2);
      expect(page.related.length, page.path).toBeLessThanOrEqual(4);
      const canonical = canonicalFor(page.path);
      expect(canonical.startsWith("https://droptexas.com")).toBe(true);
      if (page.path !== "/") expect(canonical.endsWith("/")).toBe(false);
    }
  });

  it("lists only public pages in the sitemap", () => {
    const xml = sitemapXml();
    for (const page of indexablePages()) expect(xml).toContain(canonicalFor(page.path));
    expect(xml).not.toContain("/account");
    expect(xml).not.toContain("/signin");
    expect(xml).not.toContain("/api/");
    expect(readFileSync("public/robots.txt", "utf8")).toContain("Disallow: /account");
    expect(readFileSync("public/robots.txt", "utf8")).toContain("Disallow: /api/");
  });

  it("renders one h1 per route and an alt on every image", () => {
    for (const page of SEO_PAGES) {
      const html = renderToStaticMarkup(
        routePage(page.path, { getStartedHref: "/start", action: "form", csrfToken: null, me: null }),
      );
      const h1s = html.match(/<h1\b/g) ?? [];
      expect(h1s, page.path).toHaveLength(1);
      const images = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
      for (const image of images) expect(image, page.path).toMatch(/\balt="/);
    }
  });
});
