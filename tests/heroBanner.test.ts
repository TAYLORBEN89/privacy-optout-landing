import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("full-bleed hero banner", () => {
  it("spans edge to edge without horizontal scroll and keeps text constrained", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(".hero.hero--hills {\n  margin-inline: calc(50% - 50vw);\n  border-radius: 0;\n}");
    expect(css).toContain("body {\n  overflow-x: clip;\n}");
    expect(css).toContain("width: min(1100px, 100%);");
  });
});
