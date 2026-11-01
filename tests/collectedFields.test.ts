import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PHONE = "if you choose to provide it) your phone number";

const DISCLOSURES = [
  "src/pages/PrivacyPage.tsx",
  "src/pages/HomePage.tsx",
  "src/pages/SecurityPage.tsx",
  "src/pages/topics.tsx",
  "src/components/Values.tsx",
  "README.md",
];

describe("collected fields", () => {
  it("mentions an optional phone number wherever the form fields are listed", () => {
    for (const file of DISCLOSURES) {
      const text = readFileSync(file, "utf8").replace(/\s+/g, " ");
      expect(text, file).toContain(PHONE);
    }
  });
});
