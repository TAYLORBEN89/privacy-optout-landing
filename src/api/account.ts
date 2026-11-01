import { apiUrl } from "../api";

/** Status words the product is allowed to show. Not a claim that deletion was verified. */
export const REQUEST_STATUSES = ["Submitted", "Confirmed", "Pending", "No record found"] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface OptOutHistoryItem {
  id: string;
  confirmationNumber: string;
  status: RequestStatus;
  submittedAt: string;
}

export interface ReverificationReminder {
  id: string;
  dueAt: string;
  note: string;
}

export interface AccountProfile {
  name: string | null;
  email: string | null;
}

export function readProfile(user: unknown): AccountProfile {
  if (!user || typeof user !== "object") return { name: null, email: null };
  const record = user as Record<string, unknown>;
  return {
    name: typeof record.name === "string" && record.name.trim() ? record.name : null,
    email: typeof record.email === "string" && record.email.trim() ? record.email : null,
  };
}

/**
 * TODO(account-api): GET /api/account/requests
 * Returns the signed-in person's opt-out history. Not implemented on the backend yet.
 */
export const ACCOUNT_REQUESTS_PATH = apiUrl("/api/account/requests");

/**
 * TODO(account-api): GET /api/account/reminders
 * Returns re-verification reminders. Not implemented on the backend yet.
 */
export const ACCOUNT_REMINDERS_PATH = apiUrl("/api/account/reminders");

async function readList<T>(path: string, fetchImpl: typeof fetch): Promise<T[]> {
  const response = await fetchImpl(path, { credentials: "same-origin" });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("account_request_failed");
  const body = (await response.json()) as unknown;
  return Array.isArray(body) ? (body as T[]) : [];
}

export function fetchOptOutHistory(fetchImpl: typeof fetch = fetch): Promise<OptOutHistoryItem[]> {
  return readList<OptOutHistoryItem>(ACCOUNT_REQUESTS_PATH, fetchImpl);
}

export function fetchReminders(fetchImpl: typeof fetch = fetch): Promise<ReverificationReminder[]> {
  return readList<ReverificationReminder>(ACCOUNT_REMINDERS_PATH, fetchImpl);
}
