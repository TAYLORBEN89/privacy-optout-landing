const DEFAULT_ACCOUNTS_ORIGIN = "https://accounts.droptexas.com";

function configuredAccountsOrigin(): string | undefined {
  const env = (import.meta as ImportMeta & { env?: { VITE_ACCOUNTS_ORIGIN?: string } }).env;
  const value = env?.VITE_ACCOUNTS_ORIGIN;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Accounts host. Override at build time with VITE_ACCOUNTS_ORIGIN. */
export const ACCOUNTS_ORIGIN = (configuredAccountsOrigin() ?? DEFAULT_ACCOUNTS_ORIGIN).replace(/\/$/, "");

/**
 * Same-origin relative path only. Must start with one "/", with no scheme,
 * no second slash, and no backslash. Anything else falls back to /start.
 */
export function isSafeReturnPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 2048) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("..")) return false;
  if (path.includes(":") || path.includes("://")) return false;
  return true;
}

export function accountsSignInUrl(returnTo: string, origin = ACCOUNTS_ORIGIN): string {
  const path = isSafeReturnPath(returnTo) ? returnTo : "/start";
  return `${origin.replace(/\/$/, "")}/signin?return_to=${encodeURIComponent(path)}`;
}
