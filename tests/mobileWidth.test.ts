import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");
const marker = "/* Mobile text width (below 640px)";

function mobileBlock(): string {
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf("@media (max-width: 639px) {", start);
  let depth = 0;
  for (let i = css.indexOf("{", open); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") depth -= 1;
    if (depth === 0) return css.slice(open, i + 1);
  }
  throw new Error("unclosed block");
}

describe("mobile text width CSS", () => {
  it("flattens the panel and un-indents the hash steps and privacy list only below 640px", () => {
    const block = mobileBlock();
    expect(block.startsWith("@media (max-width: 639px) {")).toBe(true);
    for (const sel of [".panel {", ".hash-flow li {", ".hash-badge {", ".privacy-list li {", ".proposal-mission {"]) {
      expect(block, sel).toContain(sel);
    }
    expect(css.trimEnd().endsWith(block)).toBe(true);
  });

  it("does not touch the intentional tapers", () => {
    const block = mobileBlock();
    expect(block).not.toMatch(/hero-stagger|hero-focus|personal-body|personal-line|stagger-br/);
  });

  it("the mobile:width script allowlists exactly the two tapers", async () => {
    const src = readFileSync("scripts/mobile-width.mjs", "utf8");
    expect(src).toContain('INTENTIONAL_TAPERS = [".hero-stagger", ".personal-body"]');
    expect(src).toContain("MIN_SHARE = 0.85");
    expect(src).toContain("sideways scroll");
  });
});
