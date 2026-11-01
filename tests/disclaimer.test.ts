import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "../src/copy";

const EXACT =
  "DROP Texas is an independent, free service run by a private individual. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.";

describe("disclaimer", () => {
  it("uses the approved private-individual wording", () => {
    expect(DISCLAIMER).toBe(EXACT);
    expect(DISCLAIMER).not.toMatch(/California|CalPrivacy/);
  });

  it("does not leave the old California wording in shipped copy", () => {
    const files = [
      "src/copy.ts",
      "src/App.tsx",
      "src/pages/AboutPage.tsx",
      "src/pages/SignInPage.tsx",
      "src/pages/StartPage.tsx",
      "src/pages/SecurityPage.tsx",
      "README.md",
      "index.html",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/CalPrivacy|State of California/);
    }
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).not.toMatch(/private-sector|not a government entity|How we keep your data safe/);
  });
});