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
    expect(hero).toContain('<span className="hero-rule">DROP Texas is a free service that helps you </span>');
    expect(hero).toContain('<span className="hero-rule">gain control of your data. </span>');
    expect(hero).toContain('<span className="hero-rule">Your data. Your rules.</span>');
    expect(hero).not.toContain("<br");
    expect(hero).not.toContain("Your data, your rules.");
    expect(hero).not.toContain("to request data brokers not sell their personal information");
    expect(hero.match(/className="lede hero-line"/g)).toHaveLength(1);
    expect(hero.match(/<p className="lede hero-line"/g)).toHaveLength(1);
    expect(hero).not.toContain("You can ask data brokers to delete");
    expect(hero).toContain("Texas Data Privacy and Security Act");
    expect(hero).not.toContain("<Reveal");
    expect(hero).toContain('id="page-title"');
    expect(hero).toContain('<h2 className="hero-sub">');
    expect(hero).toContain("Start my opt-out");
    expect(hero).not.toContain("Start Removing Me");
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("@keyframes hero-line-in");
    expect(css).toContain("animation: hero-line-in 0.7s ease 0.22s both");
    expect(css).toContain("animation: hero-line-in 0.7s ease 0.44s both");
    expect(css).toContain(".hero-rule {\n  display: block;\n  white-space: nowrap;\n}");
    expect(css).toContain("font-size: clamp(15px, 4.2vw, 18px)");
    expect(css).not.toContain("animation: hero-line-in 0.7s ease 0.66s both");
    expect(css).toContain(".hero h1,\n  .hero-sub,\n  .hero .hero-line {\n    animation: none;\n  }");
    const html = readFileSync("index.html", "utf8");
    const sentence =
      "DROP Texas is a free service for Texans to request data brokers not sell their personal information.";
    expect(html).toContain(`name="description"\n      content="${sentence}"`);
    expect(html).toContain(`property="og:description"\n      content="${sentence}"`);
    expect(html).toContain(`name="twitter:description"\n      content="${sentence}"`);
    const brand = readFileSync("src/Brand.tsx", "utf8");
    expect(brand).toContain("Demanding privacy for the people, by the people");
  });
});
