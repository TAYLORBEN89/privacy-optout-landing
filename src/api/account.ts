import { apiUrl } from "../api";
import { apiRequest, csrfHeaders, type ApiErr, type ApiOk } from "./http";

export interface StartHandoff {
  action: string;
  method: string;
  fields: Record<string, string>;
}

export const PASSWORD_STEPUP_PATH = "/api/auth/stepup/password";

/** Labels the product is allowed to show. Not a claim that deletion was verified. */
export const REQUEST_LABELS = ["Submitted", "Confirmed", "Pending", "Not completed", "No record found"] as const;

export type RequestLabel = (typeof REQUEST_LABELS)[number];

export interface OptOutRecord {
  id: string;
  kind: string;
  status: string;
  sub_status: string | null;
  broker_id: string | null;
  service_id: string | null;
  created_at: number;
  updated_at: number;
  submitted_at: number | null;
  confirmed_at: number | null;
  finished_at: number | null;
  deadline: number | null;
}

export interface AccountProfile {
  display_name: string | null;
  identifiers_locked: boolean;
}

export interface AccountSession {
  id: string;
  auth_method: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  current: boolean;
}

export function optOutLabel(record: { status: string; sub_status?: string | null }): RequestLabel {
  if (record.sub_status === "no_record") return "No record found";
  if (record.status === "pending") return "Pending";
  if (record.status === "in_progress") return "Submitted";
  if (record.status === "confirmed") return "Confirmed";
  if (record.status === "denied") return "Not completed";
  return "Pending";
}

export function formatUnix(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  return new Date(seconds * 1000).toLocaleString();
}

/** TODO(account-api): live once privacy-dashboard-api is bound. */
export const ACCOUNT_PROFILE_PATH = "/api/account/profile";
export const ACCOUNT_OPTOUTS_PATH = "/api/account/optouts";
export const ACCOUNT_SESSIONS_PATH = "/api/account/sessions";
export const ACCOUNT_EXPORT_PATH = "/api/account/export";
export const ACCOUNT_DELETE_PATH = "/api/account/delete";

function emptyOn404<T>(result: ApiOk<T> | ApiErr, empty: T): ApiOk<T> | ApiErr {
  if (!result.ok && result.status === 404) return { ok: true, data: empty };
  return result;
}

export async function fetchAccountProfile(
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<AccountProfile> | ApiErr> {
  const result = await apiRequest<AccountProfile>(ACCOUNT_PROFILE_PATH, { method: "GET" }, fetchImpl);
  return emptyOn404(result, { display_name: null, identifiers_locked: true });
}

export async function patchDisplayName(
  displayName: string,
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<{ ok: true }> | ApiErr> {
  return apiRequest(ACCOUNT_PROFILE_PATH, {
    method: "PATCH",
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ display_name: displayName }),
  }, fetchImpl);
}

export async function fetchOptOuts(
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<OptOutRecord[]> | ApiErr> {
  const result = await apiRequest<{ optouts?: OptOutRecord[] }>(ACCOUNT_OPTOUTS_PATH, { method: "GET" }, fetchImpl);
  if (!result.ok) return emptyOn404(result, []);
  return { ok: true, data: Array.isArray(result.data?.optouts) ? result.data.optouts : [] };
}

export async function fetchSessions(
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<AccountSession[]> | ApiErr> {
  const result = await apiRequest<{ sessions?: AccountSession[] }>(ACCOUNT_SESSIONS_PATH, { method: "GET" }, fetchImpl);
  if (!result.ok) return emptyOn404(result, []);
  return { ok: true, data: Array.isArray(result.data?.sessions) ? result.data.sessions : [] };
}

export function revokeSessionPath(id: string): string {
  return apiUrl(`/api/account/sessions/${id}/revoke`);
}

export async function revokeSession(
  id: string,
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<{ ok: true }> | ApiErr> {
  return apiRequest(`/api/account/sessions/${id}/revoke`, {
    method: "POST",
    headers: csrfHeaders(csrfToken),
  }, fetchImpl);
}

export async function exportAccount(
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<unknown> | ApiErr> {
  return apiRequest(ACCOUNT_EXPORT_PATH, {
    method: "POST",
    headers: csrfHeaders(csrfToken),
  }, fetchImpl);
}

export async function startPasswordStepUp(
  password: string,
  code: string,
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<{ ok?: boolean; url?: string }> | ApiErr> {
  return apiRequest(PASSWORD_STEPUP_PATH, {
    method: "POST",
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ password, code }),
  }, fetchImpl);
}

export async function deleteAccount(
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<{ ok?: boolean }> | ApiErr> {
  return apiRequest(ACCOUNT_DELETE_PATH, {
    method: "POST",
    headers: csrfHeaders(csrfToken),
  }, fetchImpl);
}

export const ACCOUNT_PROVIDERS = ["google", "microsoft"] as const;

export type AccountProvider = (typeof ACCOUNT_PROVIDERS)[number];

export function isAccountProvider(provider: string): provider is AccountProvider {
  return provider === "google" || provider === "microsoft";
}

function unsupportedProvider(): ApiErr {
  return { ok: false, status: 404, stepUp: false };
}

export function stepUpPath(provider: AccountProvider): string {
  return apiUrl(`/api/auth/${provider}/stepup`);
}

export async function startProviderStepUp(
  provider: string,
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<StartHandoff> | ApiErr> {
  if (!isAccountProvider(provider)) return unsupportedProvider();
  return apiRequest(stepUpPath(provider), {
    method: "POST",
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ return_to: "/account" }),
  }, fetchImpl);
}

/** https on droptexas.com or accounts.droptexas.com, with no embedded credentials. */
export function isAllowedStartAction(action: string): boolean {
  let url: URL;
  try {
    url = new URL(action);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  return url.hostname === "droptexas.com" || url.hostname === "accounts.droptexas.com";
}

/**
 * Posts the step-up or link handoff as a real form so the token is not placed in a URL.
 * Returns false when the action host is not allowed.
 */
export function submitStart(
  payload: { action?: unknown; method?: unknown; fields?: unknown },
  doc: Document = document,
): boolean {
  if (typeof payload.action !== "string" || !isAllowedStartAction(payload.action)) return false;
  if (typeof payload.method !== "string" || payload.method.toUpperCase() !== "POST") return false;
  if (!payload.fields || typeof payload.fields !== "object" || Array.isArray(payload.fields)) return false;
  const entries = Object.entries(payload.fields as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  if (!entries.some(([name, value]) => name === "st" && value.length > 0)) return false;

  const form = doc.createElement("form");
  form.method = "POST";
  form.action = payload.action;
  for (const [name, value] of entries) {
    const input = doc.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
  return true;
}

export async function linkIdentity(
  provider: string,
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<StartHandoff> | ApiErr> {
  if (!isAccountProvider(provider)) return unsupportedProvider();
  return apiRequest(`/api/account/identities/${provider}/link`, {
    method: "POST",
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ return_to: "/account" }),
  }, fetchImpl);
}

export async function unlinkIdentity(
  provider: string,
  csrfToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<{ ok?: boolean }> | ApiErr> {
  if (!isAccountProvider(provider)) return unsupportedProvider();
  return apiRequest(`/api/account/identities/${provider}`, {
    method: "DELETE",
    headers: csrfHeaders(csrfToken),
  }, fetchImpl);
}
