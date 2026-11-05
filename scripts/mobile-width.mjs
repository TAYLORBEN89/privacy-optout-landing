/** Mobile text-width check. Usage: npm run mobile:width <base url> [chrome path]
 * At 320, 375 and 414 wide, every body text block (p, li, h1-h3, lede) must be at least 85% of the
 * viewport width, and no page may scroll sideways. Deliberately narrow components and the two
 * intentional tapers Ben asked for are allowlisted below. */
import puppeteer from "puppeteer-core";

export const ROUTES = ["/", "/start", "/privacy", "/security", "/brokers", "/overview", "/how-it-works",
  "/personal-information", "/data-brokers", "/unique-identifiers", "/tdpsa", "/children",
  "/benefits/control", "/benefits/spam", "/benefits/security", "/benefits/time", "/benefits/cost",
  "/benefits/rights", "/benefits/children", "/help", "/share", "/about", "/texas-proposal",
  "/for-brokers", "/signin", "/account"];
export const WIDTHS = [[320, 568], [375, 667], [414, 896]];
export const MIN_SHARE = 0.85;
/** Ancestors that are narrow by design (cards, buttons, controls, chrome). */
export const NARROW_COMPONENTS = ["header", "footer", "nav", "button", "form", "dialog", "label", "table",
  "[role=dialog]", ".cta", ".marquee", ".broker-card", ".card", ".hash-badge", ".stat", ".chip", ".pill", ".account-button", ".feature-card"];
/** Intentional tapers (Ben's request). Never widen these. */
export const INTENTIONAL_TAPERS = [".hero-stagger", ".personal-body"];

const base = process.argv[2];
const chrome = (process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : "") || process.env.CHROME_PATH || "/usr/bin/google-chrome";
const json = process.argv.includes("--json");
if (!base) { console.error("Usage: npm run mobile:width <url>"); process.exit(2); }

const browser = await puppeteer.launch({ executablePath: chrome, args: ["--no-sandbox"] });
const failures = []; const report = [];
for (const [w, h] of WIDTHS) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  for (const route of ROUTES) {
    await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("main, article, h1", { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    const res = await page.evaluate((narrow, tapers, min) => {
      const vw = document.documentElement.clientWidth;
      const out = [];
      for (const el of document.querySelectorAll("main p, main li, main h1, main h2, main h3, main .lede, article p, article li, article h1, article h2, article h3")) {
        if (el.closest(narrow.join(","))) continue;
        const taper = el.closest(tapers.join(","));
        const r = el.getBoundingClientRect();
        if (!r.width || !(el.textContent || "").trim()) continue;
        const share = r.width / vw;
        if (share < min) {
          const chain = []; let n = el;
          while (n && n !== document.body && chain.length < 5) { chain.push(n.tagName.toLowerCase() + (n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).join(".") : "")); n = n.parentElement; }
          out.push({ share: Math.round(share * 1000) / 10, taper: !!taper, chain: chain.join(" < "), text: (el.textContent || "").trim().slice(0, 40) });
        }
      }
      return { vw, sw: document.documentElement.scrollWidth, narrow: out };
    }, NARROW_COMPONENTS, INTENTIONAL_TAPERS, MIN_SHARE);
    const bad = res.narrow.filter((b) => !b.taper);
    report.push({ route, w, sideways: res.sw > res.vw, narrow: res.narrow });
    if (res.sw > res.vw) failures.push(`${w} ${route}: sideways scroll ${res.sw} > ${res.vw}`);
    for (const b of bad) failures.push(`${w} ${route}: ${b.share}% ${b.chain} "${b.text}"`);
  }
  await page.close();
}
await browser.close();
if (json) console.log(JSON.stringify(report));
for (const f of failures) console.log("FAIL " + f);
console.log(failures.length ? `mobile width: ${failures.length} problem(s)` : `mobile width ok: ${ROUTES.length} routes x ${WIDTHS.length} widths`);
process.exit(failures.length ? 1 : 0);
