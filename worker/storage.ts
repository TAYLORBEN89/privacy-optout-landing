import type { SignupInput } from "../shared/signup";
import { encryptField, importPiiKey } from "./piiCrypto";
import { BROKER_SENDS, brokerSendById, type OptOutBlockCode } from "./brokerSends";

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
  /** Accounts user id when the request had a session. Null when signed out. */
  userId?: string | null;
}

/**
 * Pending broker row. status is pending, subStatus is null, and submittedAt
 * is null. This Worker does not insert in_progress, confirmed, or denied.
 */
export interface OptOutInsert {
  id: string;
  signupId: string;
  brokerId: string;
  status: "pending";
  subStatus: null;
  channel: "web_form";
  optOutUrl: string;
  httpStatus: null;
  errorCode: OptOutBlockCode;
  createdAt: string;
  updatedAt: string;
  submittedAt: null;
}

export interface SignupStore {
  save(record: SignupRecord): Promise<string>;
  saveOptOuts(rows: readonly OptOutInsert[]): Promise<void>;
}

/** D1-shaped prepare/bind used so tests can fake the database. */
export interface SignupDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean }>;
    };
  };
}

export async function saveSignup(store: SignupStore, record: SignupRecord): Promise<string> {
  return store.save(record);
}

const OPT_OUT_ROW = "(?, ?, ?, 'pending', ?, ?, ?, ?, ?)";

function assertRecordable(row: OptOutInsert, seen: Set<string>): void {
  const target = brokerSendById(row.brokerId);
  if (!target || seen.has(row.brokerId)) throw new Error("optout_status_rejected");
  seen.add(row.brokerId);
  if (row.status !== "pending") throw new Error("optout_status_rejected");
  if (row.subStatus !== null || row.httpStatus !== null || row.submittedAt !== null) {
    throw new Error("optout_status_rejected");
  }
  if (row.errorCode !== target.errorCode) throw new Error("optout_status_rejected");
  if (row.optOutUrl !== target.url || row.channel !== target.channel) {
    throw new Error("optout_status_rejected");
  }
  if (row.signupId.length === 0 || row.id.length === 0) throw new Error("optout_status_rejected");
}

/** Inserts the full broker set. The status literal is pending, so this statement cannot record a confirmation. */
export async function insertOptOuts(
  db: SignupDatabase,
  rows: readonly OptOutInsert[],
): Promise<{ success: boolean }> {
  if (rows.length !== BROKER_SENDS.length) throw new Error("optout_status_rejected");
  const seen = new Set<string>();
  for (const row of rows) assertRecordable(row, seen);
  if (seen.size !== BROKER_SENDS.length) throw new Error("optout_status_rejected");
  const sql = `INSERT INTO optout_requests (
  id, signup_id, broker_id, status, channel, opt_out_url, error_code, created_at, updated_at
) VALUES ${rows.map(() => OPT_OUT_ROW).join(", ")}`;
  const values: unknown[] = [];
  for (const row of rows) {
    values.push(
      row.id,
      row.signupId,
      row.brokerId,
      row.channel,
      row.optOutUrl,
      row.errorCode,
      row.createdAt,
      row.updatedAt,
    );
  }
  return db.prepare(sql).bind(...values).run();
}

const INSERT_SIGNUP = `INSERT INTO signups (
  id, received_at, first_name, middle_name, last_name, dob,
  address_line1, address_line2, city, state, zip, email, phone,
  texas_resident, jurisdiction, non_texas_flag, submitter,
  guardian_attestation, child_json, user_id, dob_enc, child_enc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** D1 store. Never log `record` or any of its fields. */
export class D1SignupStore implements SignupStore {
  /** piiKey is the SIGNUP_PII_KEY secret. Saving fails closed without it. */
  constructor(
    private readonly db: SignupDatabase,
    private readonly piiKey?: string,
  ) {}

  async save(record: SignupRecord): Promise<string> {
    const id = crypto.randomUUID();
    const key = await importPiiKey(this.piiKey);
    const dobEnc = await encryptField(key, record.dob, `signups:${id}:dob`);
    const childEnc = record.child ? await encryptField(key, JSON.stringify(record.child), `signups:${id}:child`) : null;
    const result = await this.db
      .prepare(INSERT_SIGNUP)
      .bind(
        id,
        record.receivedAt,
        record.firstName,
        record.middleName,
        record.lastName,
        "",
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
        null,
        record.userId ?? null,
        dobEnc,
        childEnc,
      )
      .run();
    if (!result.success) {
      throw new Error("signup_store_failed");
    }
    return id;
  }

  async saveOptOuts(rows: readonly OptOutInsert[]): Promise<void> {
    const result = await insertOptOuts(this.db, rows);
    if (!result.success) {
      throw new Error("optout_store_failed");
    }
  }
}
