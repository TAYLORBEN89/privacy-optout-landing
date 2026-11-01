import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("hero copy", () => {
  it("uses Privacy is a right as the headline and a subline under it", () => {
    const source = readFileSync("src/pages/HomePage.tsx", "utf8");
    const hero = source.slice(source.indexOf('id="overview"'), source.indexOf('className="explore"'));
    expect(hero).toContain("Privacy is a right.");
    expect(hero).toContain("Let's get you started.");
    expect(hero.match(/<h1/g)).toHaveLength(1);
    expect(hero).not.toContain("for the people");
    expect(hero).not.toContain("Demanding privacy");
    expect(hero).not.toContain("by the people");
    expect(hero).toContain(
      "DROP Texas gives you more control over your data. You can demand data brokers delete your personal information and not sell it.",
    );
    expect(hero).not.toContain("You can ask data brokers to delete");
    expect(hero).toContain("Texas Data Privacy and Security Act");
    expect(hero).not.toContain("<Reveal");
    expect(hero).toContain('id="page-title"');
    expect(hero).toContain('className="hero-sub"');
    const brand = readFileSync("src/Brand.tsx", "utf8");
    expect(brand).toContain("Demanding privacy for the people, by the people");
  });
});
