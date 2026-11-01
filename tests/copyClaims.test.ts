import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecurityPage } from "../src/pages/SecurityPage";

const BANNED = [
  /we send for you/i,
  /we file for you/i,
  /we submit for you/i,
  /we'll send/i,
  /we will send/i,
  /on your behalf/i,
  /send(?:s|ing)? (?:the |your )?(?:opt-outs?|requests?) for you/i,
  /file(?:s|d)? (?:the |your )?(?:opt-outs?|requests?) for you/i,
  /to send your requests/i,
];

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "worker-configuration.d.ts") continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) found.push(...filesUnder(path));
    else if (/\.(tsx?|md|html)$/.test(name)) found.push(path);
  }
  return found;
}

describe("copy claims", () => {
  it("does not say we send or file requests for you", () => {
    const hits: string[] = [];
    for (const path of [...filesUnder("src"), "README.md", "index.html"]) {
      const text = readFileSync(path, "utf8");
      for (const pattern of BANNED) {
        const match = text.match(pattern);
        if (!match || match.index == null) continue;
        const before = text.slice(Math.max(0, match.index - 24), match.index);
        if (/\bnot\s+$/i.test(before) || /\byou\s+$/i.test(before)) continue;
        hits.push(`${path}: ${match[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("marks the security controls that are not live", () => {
    const html = renderToStaticMarkup(createElement(SecurityPage));
    expect(html).toContain("Planned, not live yet");
    expect(html).toContain("Per-user accounts");
    expect(html).toContain("They are not live yet.");
    expect(html).toContain("built to SOC 2 standards");
    expect(html).toContain("It is not audited and not certified.");
    expect(html).not.toMatch(/verified deletion|we send for you|Apple/i);
  });
});
