import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const seo = await server.ssrLoadModule("/shared/seo.ts");
const rendered = await server.ssrLoadModule("/scripts/seo-render.tsx");
const faq = rendered.helpFaqItems();
const shell = readFileSync(join(root, "dist/index.html"), "utf8");

for (const page of seo.SEO_PAGES) {
  const html = seo.applyHead(shell, page, page.path === "/help" ? faq : []);
  const out = page.path === "/" ? join(root, "dist/index.html") : join(root, "dist", `${page.path.slice(1)}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

const sitemap = seo.sitemapXml();
const robots = seo.robotsTxt();
writeFileSync(join(root, "dist/sitemap.xml"), sitemap);
writeFileSync(join(root, "dist/robots.txt"), robots);
writeFileSync(join(root, "public/sitemap.xml"), sitemap);
writeFileSync(join(root, "public/robots.txt"), robots);

await server.close();
console.log(`wrote ${seo.SEO_PAGES.length} HTML files, sitemap, and robots`);
