/** Same-origin Worker paths. No cross-origin API host. */
export const API_BASE = "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const AUTH_PROVIDERS = ["google", "microsoft"] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export function authStartPath(provider: AuthProvider): string {
  return apiUrl(`/api/auth/${provider}/start?return_to=/start`);
}

export const ME_PATH = apiUrl("/api/me");

export const LOGOUT_PATH = apiUrl("/api/auth/logout");
