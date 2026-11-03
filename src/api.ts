/** Same-origin Worker paths. No cross-origin API host. */
export const API_BASE = "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const ME_PATH = apiUrl("/api/me");

export const LOGOUT_PATH = apiUrl("/api/auth/logout");
