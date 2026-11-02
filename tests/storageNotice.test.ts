import { describe, expect, it } from "vitest";
import {
  STORAGE_LIVE,
  STORAGE_LIVE_NOTE,
  STORAGE_PREVIEW_NOTE,
  storageNotice,
  submissionConfirmation,
} from "../worker/storage";

describe("storage notice", () => {
  it("uses the live retention sentence while storage writes", () => {
    expect(STORAGE_LIVE).toBe(true);
    expect(storageNotice()).toBe(STORAGE_LIVE_NOTE);
    expect(storageNotice()).not.toBe(STORAGE_PREVIEW_NOTE);
    expect(submissionConfirmation()).toBe("Opt-out request submitted.");
  });

  it("names the sentence that replaces the preview note", () => {
    expect(STORAGE_LIVE_NOTE).toBe(
      "Your information is stored securely and auto-deleted per our retention policy",
    );
  });
});
