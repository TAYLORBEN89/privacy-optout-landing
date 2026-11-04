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

const CONTROL_CHAR = /[\u0000-\u001f\u007f]/;
const ENCODED_REDIRECT = /%2f%2f|%5c/i;
const SCHEME = /(?:^|[^a-z0-9+.-])[a-z][a-z0-9+.-]*:/i;
const START_STEP = /^\/start#step-[1-9][0-9]?$/;

/**
 * Allowed return paths only: /start, /account, /start?for=child,
 * or /start#step-N where N is an integer from 1 to 99.
 * /start?for=child is an exact match. No other query string is allowed.
 * Checked after one decode.
 * Rejects control characters, a leading // or /\, any backslash,
 * a scheme, encoded %2F%2F or %5C, "..", and anything over 2048 characters.
 * Anything else falls back to /start.
 */
function unsafeReturnShape(path: string): boolean {
  if (path.length === 0 || path.length > 2048) return true;
  if (CONTROL_CHAR.test(path)) return true;
  if (path.startsWith("//") || path.startsWith("/\\")) return true;
  if (path.includes("\\") || path.includes("..")) return true;
  if (ENCODED_REDIRECT.test(path)) return true;
  if (SCHEME.test(path) || path.includes("://")) return true;
  return false;
}

function allowedReturnPath(path: string): boolean {
  return path === "/start" || path === "/account" || path === "/start?for=child" || START_STEP.test(path);
}

export function isSafeReturnPath(path: string): boolean {
  if (typeof path !== "string") return false;
  if (unsafeReturnShape(path)) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  if (unsafeReturnShape(decoded)) return false;
  return allowedReturnPath(path) && allowedReturnPath(decoded);
}

export function accountsSignInUrl(returnTo: string, origin = ACCOUNTS_ORIGIN): string {
  const path = isSafeReturnPath(returnTo) ? returnTo : "/start";
  return `${origin.replace(/\/$/, "")}/signin?return_to=${encodeURIComponent(path)}`;
}
