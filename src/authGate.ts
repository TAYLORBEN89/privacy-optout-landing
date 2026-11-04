import { isSafeReturnPath } from "../shared/accounts";
import { ME_PATH } from "./api";

/**
 * Draft default is on. Set VITE_AUTH_GATE=false at build time to show /start
 * without a session while auth is not live.
 */
export function authGateEnabled(raw?: string): boolean {
  const value = raw === undefined ? import.meta.env.VITE_AUTH_GATE : raw;
  if (value === undefined || value === "") return true;
  return value !== "false" && value !== "0";
}

/** On-site sign-in. An unsafe return path falls back to /start. */
export function signInHrefFor(returnTo: string): string {
  const safe = isSafeReturnPath(returnTo) ? returnTo : "/start";
  return `/signin?return_to=${encodeURIComponent(safe)}`;
}

export const SIGN_IN_HREF = signInHrefFor("/start");

export function startHref(gateEnabled: boolean, signedIn: boolean): string {
  if (!gateEnabled || signedIn) return "/start";
  return signInHrefFor("/start");
}

export type StartAction = "loading" | "form" | "redirect" | "unavailable";

export function startPageAction(
  gateEnabled: boolean,
  meStatus: number | "loading" | "error",
): StartAction {
  if (!gateEnabled) return "form";
  if (meStatus === 200) return "form";
  if (meStatus === "loading") return "loading";
  if (meStatus === 401) return "redirect";
  return "unavailable";
}

const PROVIDER_START = {
  google: "/api/auth/google/start",
  microsoft: "/api/auth/microsoft/start",
} as const;

/** Same-origin start URL for Google or Microsoft. No other provider. */
export function providerStartHref(provider: "google" | "microsoft", returnTo: string | null): string {
  const safe = returnTo && isSafeReturnPath(returnTo) ? returnTo : "/start";
  return `${PROVIDER_START[provider]}?return_to=${encodeURIComponent(safe)}`;
}

export interface MeUser {
  id: string;
  display_name: string | null;
  has_password: boolean;
  totp_enabled: boolean;
  created_at: number;
}

export interface MeProvider {
  provider: string;
  verified?: boolean;
  private_relay?: boolean;
  email_verified?: boolean;
  is_private_relay?: boolean;
}

export interface MeOk {
  ok: true;
  user: MeUser;
  providers: MeProvider[];
  auth_method: string;
  mfa: boolean;
  limited: boolean;
  stepped_up_until: number | null;
  csrf_token: string;
}

export interface MeFail {
  ok: false;
  status: number;
}

export async function fetchMe(fetchImpl: typeof fetch = fetch): Promise<MeOk | MeFail> {
  const response = await fetchImpl(ME_PATH, { credentials: "same-origin" });
  if (response.status !== 200) return { ok: false, status: response.status };
  const body = (await response.json()) as Partial<MeOk>;
  if (typeof body.csrf_token !== "string" || body.csrf_token.length === 0 || !body.user) {
    return { ok: false, status: response.status };
  }
  return {
    ok: true,
    user: body.user,
    providers: Array.isArray(body.providers) ? body.providers : [],
    auth_method: typeof body.auth_method === "string" ? body.auth_method : "",
    mfa: Boolean(body.mfa),
    limited: Boolean(body.limited),
    stepped_up_until: typeof body.stepped_up_until === "number" ? body.stepped_up_until : null,
    csrf_token: body.csrf_token,
  };
}
