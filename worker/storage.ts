import type { SignupInput } from "../shared/signup";

/**
 * True only while saveSignup() writes to D1. The page uses the live
 * retention sentence in that case.
 */
export const STORAGE_LIVE = true;

export const STORAGE_PREVIEW_NOTE = "This is a preview. Nothing you enter is saved yet.";

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
 * Validated signup plus a receipt time. `jurisdiction` is TDPSA for every
 * record. `nonTexasFlag` is true when the Texas box was unchecked. Do not add
 * raw request bodies.
 */
export interface SignupRecord extends SignupInput {
  receivedAt: string;
}

export interface SignupStore {
  save(record: SignupRecord): Promise<void>;
}

/** D1-shaped prepare/bind used so tests can fake the database. */
export interface SignupDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean }>;
    };
  };
}

export async function saveSignup(store: SignupStore, record: SignupRecord): Promise<void> {
  await store.save(record);
}

const INSERT_SIGNUP = `INSERT INTO signups (
  id, received_at, first_name, middle_name, last_name, dob,
  address_line1, address_line2, city, state, zip, email, phone,
  texas_resident, jurisdiction, non_texas_flag, submitter,
  guardian_attestation, child_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** D1 store. Never log `record` or any of its fields. */
export class D1SignupStore implements SignupStore {
  constructor(private readonly db: SignupDatabase) {}

  async save(record: SignupRecord): Promise<void> {
    const result = await this.db
      .prepare(INSERT_SIGNUP)
      .bind(
        crypto.randomUUID(),
        record.receivedAt,
        record.firstName,
        record.middleName,
        record.lastName,
        record.dob,
        record.addressLine1,
        record.addressLine2,
        record.city,
        record.state,
        record.zip,
        record.email,
        record.phone,
        record.texasResident ? 1 : 0,
        record.jurisdiction,
        record.nonTexasFlag ? 1 : 0,
        record.submitter,
        record.guardianAttestation ? 1 : 0,
        record.child ? JSON.stringify(record.child) : null,
      )
      .run();
    if (!result.success) {
      throw new Error("signup_store_failed");
    }
  }
}
