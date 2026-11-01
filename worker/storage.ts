import type { SignupInput } from "../shared/signup";

/**
 * Flip this only when `saveSignup` is actually writing records.
 * While false, the page keeps the preview storage note.
 */
export const STORAGE_LIVE = false;

export const STORAGE_PREVIEW_NOTE =
  "This preview checks your details and does not store them yet.";

export const STORAGE_LIVE_NOTE =
  "Your information is stored securely and auto-deleted per our retention policy";

export function storageNotice(): string {
  return STORAGE_LIVE ? STORAGE_LIVE_NOTE : STORAGE_PREVIEW_NOTE;
}

/** Phrase allowed on the success state. Not a claim that deletion was verified. */
export function submissionConfirmation(): string {
  return STORAGE_LIVE ? "Opt-out request submitted." : "Confirmation received.";
}

/**
 * Fields the future store may persist. This is the validated signup plus a
 * receipt time. `jurisdiction` is TDPSA for every record. `nonTexasFlag` is
 * true when the Texas box was unchecked. Do not add raw request bodies.
 */
export interface SignupRecord extends SignupInput {
  receivedAt: string;
}

/**
 * Persistence boundary for opt-out requests.
 *
 * TODO(storage): a separate backend agent owns D1/KV. Implement this against
 * that binding. Do not log `record` or any of its fields. Do not add the
 * binding to wrangler.jsonc until that store exists.
 */
export interface SignupStore {
  save(record: SignupRecord): Promise<void>;
}

/**
 * TODO(storage): call this from the signup handler after validation succeeds.
 * v1 does not call it, so nothing is persisted.
 */
export async function saveSignup(store: SignupStore, record: SignupRecord): Promise<void> {
  await store.save(record);
}
