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
 * Allowed return paths only: /start, /account, or /start#step-N
 * where N is an integer from 1 to 99. Anything else falls back to /start.
 */
export function isSafeReturnPath(path: string): boolean {
  if (typeof path !== "string") return false;
  return path === "/start" || path === "/account" || /^\/start#step-[1-9][0-9]?$/.test(path);
}

export function accountsSignInUrl(returnTo: string, origin = ACCOUNTS_ORIGIN): string {
  const path = isSafeReturnPath(returnTo) ? returnTo : "/start";
  return `${origin.replace(/\/$/, "")}/signin?return_to=${encodeURIComponent(path)}`;
}
