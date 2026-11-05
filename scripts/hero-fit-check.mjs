/** Check the staggered hero description against a running site: every line fits the <p> content box and tapers.
 * Usage: node scripts/hero-fit-check.mjs http://localhost:4173/ [chrome path] */
import puppeteer from "puppeteer-core";

const base = process.argv[2];
const chrome = process.argv[3] || process.env.CHROME_PATH || "/usr/bin/google-chrome";
if (!base) {
  console.error("Usage: node scripts/hero-fit-check.mjs <url> [chrome path]");
  process.exit(2);
}
const sizes = [[320, 568], [360, 780], [375, 667], [390, 844], [768, 1024], [1024, 768], [1440, 900]];
const browser = await puppeteer.launch({ executablePath: chrome, args: ["--no-sandbox"] });
const page = await browser.newPage();
let failed = false;
for (const [width, height] of sizes) {
  await page.setViewport({ width, height });
  await page.goto(base, { waitUntil: "networkidle0" });
  const r = await page.evaluate(() => {
    const el = document.querySelector(".hero-stagger");
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const left = box.left + parseFloat(cs.paddingLeft);
    const right = box.right - parseFloat(cs.paddingRight);
    const rows = new Map();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      for (let i = 0; i < node.length; i++) {
        if (!node.data[i].trim()) continue;
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const c = range.getClientRects()[0];
        if (!c) continue;
        const key = Math.round(c.top);
        const row = rows.get(key) || { l: Infinity, r: -Infinity, t: "" };
        row.l = Math.min(row.l, c.left);
        row.r = Math.max(row.r, c.right);
        rows.set(key, row);
      }
    }
    const lines = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => ({ w: v.r - v.l, l: v.l, r: v.r }));
    const d = document.documentElement;
    return { box: right - left, left, right, lines, sw: d.scrollWidth, cw: d.clientWidth };
  });
  const problems = [];
  r.lines.forEach((line, i) => {
    if (line.r > r.right + 0.5 || line.l < r.left - 0.5) problems.push(`line ${i + 1} (${line.w.toFixed(1)}px) exceeds the ${r.box.toFixed(1)}px text box`);
    if (i > 0 && !(line.w < r.lines[i - 1].w)) problems.push(`line ${i + 1} is not narrower than line ${i}`);
  });
  if (r.sw > r.cw) problems.push(`horizontal scroll (${r.sw} > ${r.cw})`);
  const widths = r.lines.map((l) => l.w.toFixed(1)).join(" / ");
  console.log(`${width}x${height} box ${r.box.toFixed(1)}px lines ${widths}${problems.length ? " FAIL: " + problems.join("; ") : " ok"}`);
  if (problems.length) failed = true;
}
await browser.close();
process.exit(failed ? 1 : 0);
