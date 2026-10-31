import type { SignupInput } from "../shared/signup";

/**
 * Fields the future store may persist. This is the validated signup plus a
 * receipt time. Do not add raw request bodies or extra JSON keys.
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
