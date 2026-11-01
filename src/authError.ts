const AUTH_ERROR_MESSAGES: Record<string, string> = {
  bad_start: "That sign-in link expired. Please try again.",
  start_reused: "That sign-in link expired. Please try again.",
  browser_mismatch: "Please finish signing in using the same browser you started in.",
  identity_in_use: "That Google or Microsoft account is already linked to another DROP Texas account.",
};

export function authErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? null;
}

export function stripAuthError(href: string): string {
  const url = new URL(href, "https://droptexas.com");
  url.searchParams.delete("auth_error");
  return `${url.pathname}${url.search}${url.hash}`;
}
