import { describe, expect, it } from "vitest";
import {
  STORAGE_LIVE,
  STORAGE_LIVE_NOTE,
  STORAGE_PREVIEW_NOTE,
  storageNotice,
  submissionConfirmation,
} from "../worker/storage";

describe("storage notice", () => {
  it("keeps the preview note until storage is live", () => {
    expect(STORAGE_LIVE).toBe(false);
    expect(storageNotice()).toBe(STORAGE_PREVIEW_NOTE);
    expect(storageNotice()).toBe("This preview checks your details and does not store them yet.");
    expect(submissionConfirmation()).toBe("Confirmation received.");
  });

  it("names the sentence that replaces the preview note", () => {
    expect(STORAGE_LIVE_NOTE).toBe(
      "Your information is stored securely and auto-deleted per our retention policy",
    );
  });
});
