import { describe, expect, it } from "vitest";
import { BROKERS } from "../src/data/brokers";

describe("broker marquee data", () => {
  it("starts with the approved names and does not invent more", () => {
    expect([...BROKERS]).toEqual([
      "DMAchoice",
      "Catalog Choice",
      "Acxiom",
      "Epsilon",
      "Equifax",
      "Experian",
      "TransUnion",
      "Spokeo",
      "Whitepages",
    ]);
  });
});
