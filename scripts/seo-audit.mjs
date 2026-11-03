/**
 * Yoast-style checks computed here. This is not the Yoast plugin.
 * Body checks use the rendered route. Link checks include the site footer.
 */
import { writeFileSync } from "node:fs";
import { Window } from "happy-dom";
import { createServer } from "vite";

const TRANSITIONS = [
  "for example",
  "for instance",
  "in addition",
  "as a result",
  "in other words",
  "in short",
  "above all",
  "that is",
  "such as",
  "and",
  "but",
  "so",
  "because",
  "if",
  "when",
  "also",
  "then",
  "however",
  "therefore",
  "although",
  "though",
  "since",
  "after",
  "before",
  "once",
  "until",
  "meanwhile",
  "instead",
  "still",
  "again",
  "too",
  "first",
  "second",
  "next",
  "finally",
  "while",
  "accordingly",
].sort((a, b) => b.length - a.length);

const PASSIVE =
  /\b(am|is|are|was|were|be|been|being)\s+(?:\w+\s+){0,2}([a-z]+ed|chosen|known|shown|sent|made|kept|held|sold|found|built|done|seen|given|taken|written|left|meant)\b/i;

function words(text) {
  return text.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g) ?? [];
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => words(part).length > 0);
}

function syllables(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/e$/, "");
  const groups = trimmed.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function flesch(text) {
  const list = sentences(text);
  const all = words(text);
  if (!list.length || !all.length) return null;
  const syl = all.reduce((sum, word) => sum + syllables(word), 0);
  return 206.835 - 1.015 * (all.length / list.length) - 84.6 * (syl / all.length);
}

function countPhrase(text, phrase) {
  const hay = text.toLowerCase();
  const needle = phrase.toLowerCase();
  let count = 0;
  let from = 0;
  while (from <= hay.length) {
    const at = hay.indexOf(needle, from);
    if (at === -1) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

function hasTransition(sentence) {
  const hay = ` ${sentence.toLowerCase()} `;
  return TRANSITIONS.some((word) => hay.includes(` ${word} `) || sentence.toLowerCase().startsWith(`${word} `));
}

function parse(html) {
  const window = new Window();
  window.document.write(`<!doctype html><html><body>${html}</body></html>`);
  return window.document;
}

function headingSkips(document) {
  const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => Number(node.tagName.slice(1)));
  let prev = 0;
  for (const level of levels) {
    if (prev > 0 && level > prev + 1) return true;
    prev = level;
  }
  return false;
}

function maxWordsBetweenSubheads(document) {
  const nodes = [...document.querySelectorAll("h1,h2,h3,p,li")];
  let since = 0;
  let max = 0;
  for (const node of nodes) {
    if (node.tagName === "LI" && node.querySelector("p")) continue;
    if (/^H[1-3]$/.test(node.tagName) && node.tagName !== "H1") {
      since = 0;
      continue;
    }
    if (node.tagName === "H1") continue;
    since += words(node.textContent ?? "").length;
    max = Math.max(max, since);
  }
  return max;
}

function linkStats(document) {
  const links = [...document.querySelectorAll("a[href]")];
  let internal = 0;
  let external = 0;
  let externalMissingRel = 0;
  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("/") && !href.startsWith("//")) internal += 1;
    else if (/^https?:\/\//i.test(href)) {
      external += 1;
      const rel = link.getAttribute("rel") ?? "";
      const blank = link.getAttribute("target") === "_blank";
      if (blank && !rel.split(/\s+/).includes("noopener")) externalMissingRel += 1;
    }
  }
  return { internal, external, externalMissingRel };
}

function status(ok, detail, note) {
  if (note) return { result: "n/a", detail: note };
  return { result: ok ? "pass" : "fail", detail };
}

const dom = new Window({ url: "https://droptexas.com/" });
Object.defineProperty(globalThis, "window", { value: dom, configurable: true });
Object.defineProperty(globalThis, "document", { value: dom.document, configurable: true });

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const seo = await server.ssrLoadModule("/shared/seo.ts");
const rendered = await server.ssrLoadModule("/scripts/seo-render.tsx");

const rows = [];
for (const page of seo.SEO_PAGES) {
  const view = rendered.renderRoute(page.path);
  const doc = parse(view.page);
  const linked = parse(view.withFooter);
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  const h1s = [...doc.querySelectorAll("h1")].map((node) => (node.textContent ?? "").trim());
  const subheads = [...doc.querySelectorAll("h2,h3")].map((node) => (node.textContent ?? "").trim());
  const firstP = (doc.querySelector("p")?.textContent ?? "").replace(/\s+/g, " ").trim();
  const alts = [...doc.querySelectorAll("img")].map((img) => img.getAttribute("alt"));
  const contentAlts = alts.filter((alt) => alt && alt.trim());
  const wordList = words(text);
  const sentenceList = sentences(text);
  const phraseCount = countPhrase(text, page.focus);
  const density = wordList.length ? (phraseCount / wordList.length) * 100 : 0;
  const longSentences = sentenceList.filter((sentence) => words(sentence).length > 20).length;
  const longPct = sentenceList.length ? (longSentences / sentenceList.length) * 100 : 0;
  const passive = sentenceList.filter((sentence) => PASSIVE.test(sentence)).length;
  const passivePct = sentenceList.length ? (passive / sentenceList.length) * 100 : 0;
  const withTransition = sentenceList.filter(hasTransition).length;
  const transitionPct = sentenceList.length ? (withTransition / sentenceList.length) * 100 : 0;
  const ease = flesch(text);
  const paragraphs = [...doc.querySelectorAll("p,li")]
    .filter((node) => node.tagName !== "LI" || !node.querySelector("p"))
    .map((node) => words(node.textContent ?? "").length);
  const longestParagraph = paragraphs.reduce((max, count) => Math.max(max, count), 0);
  const gap = maxWordsBetweenSubheads(doc);
  const links = linkStats(linked);
  const imageNote = alts.length === 0 ? "n/a (no image on this page)" : contentAlts.length === 0 ? "n/a (decorative images only)" : undefined;
  const slug = "n/a (route kept)";

  const contains = (value) => value.toLowerCase().includes(page.focus.toLowerCase());
  rows.push({
    path: page.path,
    focus: page.focus,
    related: page.related,
    title: page.title,
    description: page.description,
    titleChars: page.title.length,
    descriptionChars: page.description.length,
    checks: {
      titleLength: status(page.title.length >= 50 && page.title.length <= 60, `${page.title.length} chars`),
      descriptionLength: status(page.description.length >= 140 && page.description.length <= 156, `${page.description.length} chars`),
      keyphraseInTitle: status(contains(page.title), contains(page.title) ? "yes" : "no", page.bodyNote),
      keyphraseInDescription: status(contains(page.description), contains(page.description) ? "yes" : "no"),
      keyphraseInH1: status(h1s.some(contains), h1s.join(" | ") || "none", page.bodyNote),
      keyphraseInFirstParagraph: status(contains(firstP), firstP.slice(0, 140) || "none", page.bodyNote),
      keyphraseInSubheading: status(subheads.some(contains), subheads.filter(contains).join(" | ") || "none", page.bodyNote),
      keyphraseInImageAlt: status(contentAlts.some(contains), contentAlts.join(" | ") || "none", page.bodyNote ?? imageNote),
      slug,
      density: status(density >= 0.5 && density <= 3, `${density.toFixed(2)}% (${phraseCount}/${wordList.length})`, page.bodyNote),
      internalLinks: status(links.internal >= 1, String(links.internal)),
      outboundLinks: status(links.external >= 1 && links.externalMissingRel === 0, `${links.external} external, ${links.externalMissingRel} missing noopener`),
      wordCount: status(wordList.length >= 300, `${wordList.length} words`, page.wordsNote),
      sentenceLength: status(sentenceList.length > 0 && longPct <= 25, `${longPct.toFixed(1)}% over 20 words`, page.wordsNote),
      paragraphLength: status(longestParagraph <= 150, `longest ${longestParagraph} words`, page.wordsNote),
      subheadingSpacing: status(gap <= 300, `max ${gap} words between subheads`, page.wordsNote),
      passiveVoice: status(sentenceList.length > 0 && passivePct < 10, `${passivePct.toFixed(1)}%`, page.wordsNote),
      transitionWords: status(sentenceList.length > 0 && transitionPct >= 30, `${transitionPct.toFixed(1)}%`, page.wordsNote),
      flesch: status(ease != null && ease >= 60, ease == null ? "n/a" : ease.toFixed(1), page.wordsNote),
      oneH1: status(h1s.length === 1, String(h1s.length)),
      headingOrder: status(!headingSkips(doc), headingSkips(doc) ? "skipped level" : "ok"),
      imageAlts: status(alts.every((alt) => alt != null), `${alts.length} images`),
    },
  });
}

await server.close();
writeFileSync("scripts/seo-audit.json", JSON.stringify(rows, null, 2));

const checkNames = Object.keys(rows[0].checks);
console.log(["path", ...checkNames].join("\t"));
for (const row of rows) {
  const cells = checkNames.map((name) => {
    const check = row.checks[name];
    return typeof check === "string" ? check : `${check.result}${check.detail ? ` (${check.detail})` : ""}`;
  });
  console.log([row.path, ...cells].join("\t"));
}
