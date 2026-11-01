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
 * A same-site return path: starts with a single slash, stays on this origin,
 * and is not a protocol-relative URL.
 */
export function isSafeReturnPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 512) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("://") || /[\u0000-\u001F\u007F\s]/.test(path)) return false;
  let url: URL;
  try {
    url = new URL(path, "https://droptexas.com");
  } catch {
    return false;
  }
  return url.origin === "https://droptexas.com" && url.pathname.startsWith("/") && !url.pathname.startsWith("//");
}

export function accountsSignInUrl(returnTo: string, origin = ACCOUNTS_ORIGIN): string {
  const path = isSafeReturnPath(returnTo) ? returnTo : "/start";
  return `${origin.replace(/\/$/, "")}/signin?return_to=${encodeURIComponent(path)}`;
}
