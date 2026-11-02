import { describe, expect, it } from "vitest";
import { D1SignupStore, type SignupRecord } from "../worker/storage";

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
    await new D1SignupStore(db).save(record);
    expect(sql).toContain("INSERT INTO signups");
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
});
