import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "../src/copy";

const EXACT =
  "DROP Texas is an independent, free service run by Benjamin Taylor, an individual in Texas. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.";

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.(tsx?|md|html|css|jsonc)$/.test(name)) found.push(path);
  }
  return found;
}

describe("disclaimer", () => {
  it("uses the approved independent-service wording", () => {
    expect(DISCLAIMER).toBe(EXACT);
    expect(DISCLAIMER).not.toMatch(/California|CalPrivacy/);
  });

  it("does not leave the old private-individual wording in source", () => {
    const retired = ["private", "individual"].join(" ");
    const files = [...sourceFiles("src"), ...sourceFiles("tests"), "README.md", "index.html"];
    const hits = files.filter((file) => readFileSync(file, "utf8").includes(retired));
    expect(hits).toEqual([]);
  });

  it("does not leave the old California wording in shipped copy", () => {
    const files = [
      "src/copy.ts",
      "src/App.tsx",
      "src/pages/AboutPage.tsx",
      "src/pages/SignInPage.tsx",
      "src/pages/StartPage.tsx",
      "src/pages/SecurityPage.tsx",
      "src/pages/PrivacyPage.tsx",
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
