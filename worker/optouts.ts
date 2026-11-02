import { BROKER_SENDS } from "./brokerSends";
import type { OptOutInsert, SignupStore } from "./storage";

/**
 * Builds one pending row per named broker. sub_status stays null so the
 * product label stays Pending and is never "No record found". submitted_at
 * stays null because no request was accepted. This does not contact the broker.
 */
export function buildOptOutRows(signupId: string, now: Date = new Date()): OptOutInsert[] {
  const stamp = now.toISOString();
  return BROKER_SENDS.map((target) => ({
    id: crypto.randomUUID(),
    signupId,
    brokerId: target.id,
    status: "pending",
    subStatus: null,
    channel: target.channel,
    optOutUrl: target.url,
    httpStatus: null,
    errorCode: target.errorCode,
    createdAt: stamp,
    updatedAt: stamp,
    submittedAt: null,
  }));
}

/**
 * Records the nine pending rows after the signup insert has succeeded.
 * Interactive brokers are not sent a POST. Confirmed is never written.
 */
export async function dispatchOptOuts(
  store: SignupStore,
  signupId: string,
  now: Date = new Date(),
): Promise<void> {
  const rows = buildOptOutRows(signupId, now);
  await store.saveOptOuts(rows);
  console.log(
    JSON.stringify({
      message: "optout_recorded",
      count: rows.length,
      results: rows.map((row) => ({
        broker_id: row.brokerId,
        status: row.status,
        error_code: row.errorCode,
      })),
    }),
  );
}
