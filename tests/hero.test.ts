import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("hero copy", () => {
  it("uses the short description under the three-line headline", () => {
    const source = readFileSync("src/pages/HomePage.tsx", "utf8");
    expect(source).toContain("Demanding privacy");
    expect(source).toContain("for the people");
    expect(source).toContain("by the people");
    expect(source).toContain(
      "DROP Texas gives you more control over your data. You can demand data brokers delete your personal information and not sell it.",
    );
    expect(source).not.toContain("You can ask data brokers to delete");
    expect(source).toContain("Texas Data Privacy and Security Act");
    const hero = source.slice(source.indexOf('id="overview"'), source.indexOf('id="how-drop-works"'));
    expect(hero).not.toContain("<Reveal");
    expect(hero).toContain('id="page-title"');
  });
});
