import { describe, expect, it } from "vitest";
// @ts-expect-error plain mjs script
import { proposalSmokeProblems } from "../scripts/proposal-smoke.mjs";

const ok = 'The Texas Proposal className:"hero-proposal-link",href:"/texas-proposal",children:"Read the Texas Proposal"';

describe("proposal smoke", () => {
  it("passes with the hero link and no header link or Menu", () => {
    expect(proposalSmokeProblems(ok)).toEqual([]);
  });
  it("fails without the hero link", () => {
    expect(proposalSmokeProblems('The Texas Proposal href:"/texas-proposal"').length).toBe(1);
  });
  it("fails when the header link or Menu is back", () => {
    expect(proposalSmokeProblems(ok + ' className:"proposal-link-desktop"').length).toBe(1);
    expect(proposalSmokeProblems(ok + ' children:"Menu"').length).toBe(1);
  });
});
