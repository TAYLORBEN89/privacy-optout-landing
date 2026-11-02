import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPT_OUT_BLOCK_CODES } from "../worker/brokerSends";
import { buildOptOutRows } from "../worker/optouts";
import { D1SignupStore, insertOptOuts, type OptOutInsert, type SignupRecord } from "../worker/storage";

const record: SignupRecord = {
  firstName: "Ada",
  middleName: null,
  lastName: "Lovelace",
  dob: "1990-01-15",
  addressLine1: "123 Main St",
  addressLine2: null,
  city: "Austin",
  state: "TX",
  zip: "78701",
  email: "ada@example.com",
  phone: "+15125550100",
  texasResident: true,
  jurisdiction: "TDPSA",
  nonTexasFlag: false,
  submitter: "self",
  child: null,
  guardianAttestation: false,
  receivedAt: "2026-11-01T00:00:00.000Z",
};

describe("D1SignupStore", () => {
  it("inserts with bound parameters and does not interpolate field values into SQL", async () => {
    let sql = "";
    let binds: unknown[] = [];
    const db = {
      prepare(query: string) {
        sql = query;
        return {
          bind(...values: unknown[]) {
            binds = values;
            return {
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    };
    const id = await new D1SignupStore(db).save(record);
    expect(id).toBe(binds[0]);
    expect(sql).toContain("INSERT INTO signups");
    expect(sql).not.toContain(String(id));
    expect(sql).not.toContain("Ada");
    expect(sql).not.toContain("ada@example.com");
    expect(sql.match(/\?/g)?.length).toBe(19);
    expect(binds[2]).toBe("Ada");
    expect(binds[12]).toBe("+15125550100");
    expect(binds[18]).toBeNull();
  });

  it("stores a child request as JSON in the last bound value", async () => {
    let binds: unknown[] = [];
    const db = {
      prepare() {
        return {
          bind(...values: unknown[]) {
            binds = values;
            return {
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    };
    await new D1SignupStore(db).save({
      ...record,
      submitter: "child",
      guardianAttestation: true,
      child: {
        firstName: "Grace",
        middleName: null,
        lastName: "Hopper",
        dob: "2018-01-01",
        sameAddress: true,
      },
    });
    expect(JSON.parse(String(binds[18]))).toEqual({
      firstName: "Grace",
      middleName: null,
      lastName: "Hopper",
      dob: "2018-01-01",
      sameAddress: true,
    });
  });

  it("inserts nine pending broker rows with bound parameters and a pending status literal", async () => {
    let sql = "";
    let binds: unknown[] = [];
    const db = {
      prepare(query: string) {
        sql = query;
        return {
          bind(...values: unknown[]) {
            binds = values;
            return {
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    };
    const rows = buildOptOutRows("signup-1", new Date("2026-11-02T00:00:00.000Z"));
    await new D1SignupStore(db).saveOptOuts(rows);
    expect(sql).toContain("INSERT INTO optout_requests");
    expect(sql.match(/'pending'/g)?.length).toBe(9);
    expect(sql).not.toContain("confirmed");
    expect(sql).not.toContain("signup-1");
    expect(sql).not.toContain("spokeo.com");
    expect(sql.match(/\?/g)?.length).toBe(72);
    expect(binds).toHaveLength(72);
    expect(binds.filter((value) => value === "signup-1")).toHaveLength(9);
    expect(binds.filter((value) => value === "pending")).toHaveLength(0);
    expect(binds).toContain("spokeo");
    expect(binds).toContain("profile_url");
    expect(binds).toContain("https://www.spokeo.com/optout");
    expect(binds).not.toContain("Ada");
    expect(binds).not.toContain("ada@example.com");
  });

  it("refuses a confirmed or partial set before preparing SQL", async () => {
    let prepared = 0;
    const db = {
      prepare() {
        prepared += 1;
        return {
          bind() {
            return {
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    };
    const rows = buildOptOutRows("signup-1", new Date("2026-11-02T00:00:00.000Z"));
    const confirmed = rows.map((row, index) =>
      index === 0 ? { ...row, status: "confirmed" } : row,
    );
    await expect(insertOptOuts(db, confirmed as unknown as OptOutInsert[])).rejects.toThrow(
      "optout_status_rejected",
    );
    await expect(insertOptOuts(db, rows.slice(0, 8))).rejects.toThrow("optout_status_rejected");
    expect(prepared).toBe(0);
  });
});

describe("opt-out schema", () => {
  it("allows only the machine block codes", () => {
    const sql = readFileSync("migrations/0002_optout_requests.sql", "utf8");
    for (const code of OPT_OUT_BLOCK_CODES) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toContain("'pending'");
    expect(sql).toContain("'confirmed'");
    expect(sql).not.toContain("first_name");
    expect(sql).not.toContain("email");
  });
});
