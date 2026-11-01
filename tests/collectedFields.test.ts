import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PHONE = "if you choose to provide it) your phone number";

const DISCLOSURES = [
  "src/pages/PrivacyPage.tsx",
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

  it("uses Ben's yellow-band body and does not add an at-rest claim", () => {
    const page = readFileSync("src/pages/HomePage.tsx", "utf8").replace(/\s+/g, " ");
    expect(page).toContain(
      "We collect only your name, date of birth, mailing address, email, Texas residency and your phone number. Everything you send is encrypted in transit, and we never sell your data.",
    );
    expect(page).toContain("Your information, protected");
    expect(page).toContain("Only what we need. Nothing more.");
    expect(page).toContain("{storageNotice()}");
    expect(page).not.toContain("Your information is protected.");
    expect(page).not.toContain("at rest");
    expect(page).not.toContain("encrypted at rest");
  });
});
