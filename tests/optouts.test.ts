import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BROKERS } from "../src/data/brokers";
import { optOutLabel } from "../src/api/account";
import { BROKER_SENDS, OPT_OUT_BLOCK_CODES } from "../worker/brokerSends";
import { buildOptOutRows } from "../worker/optouts";

describe("broker send catalog", () => {
  it("follows the named brokers and stays interactive", () => {
    expect(BROKER_SENDS.map((target) => target.name)).toEqual([...BROKERS]);
    expect(new Set(BROKER_SENDS.map((target) => target.id)).size).toBe(BROKERS.length);
    for (const target of BROKER_SENDS) {
      expect(target.mode).toBe("interactive");
      expect(target.channel).toBe("web_form");
      expect(target.url.startsWith("https://")).toBe(true);
      expect(OPT_OUT_BLOCK_CODES).toContain(target.errorCode);
      expect(target.detail.length).toBeGreaterThan(20);
      expect(target.detail.toLowerCase()).not.toContain("confirmed");
    }
    expect(BROKER_SENDS.find((target) => target.id === "equifax")?.errorCode).toBe("fcra_and_form");
    expect(BROKER_SENDS.find((target) => target.id === "spokeo")?.errorCode).toBe("profile_url");
    expect(BROKER_SENDS.find((target) => target.id === "dmachoice")?.errorCode).toBe("account");
  });

  it("builds nine pending rows and does not call fetch", () => {
    const source = readFileSync("worker/optouts.ts", "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    const rows = buildOptOutRows("signup-1", new Date("2026-11-02T00:00:00.000Z"));
    expect(rows).toHaveLength(9);
    for (const row of rows) {
      expect(row.status).toBe("pending");
      expect(row.subStatus).toBeNull();
      expect(row.submittedAt).toBeNull();
      expect(row.httpStatus).toBeNull();
      expect(optOutLabel({ status: row.status, sub_status: row.subStatus })).toBe("Pending");
    }
  });
});
