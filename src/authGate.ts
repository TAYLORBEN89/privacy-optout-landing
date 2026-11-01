import { ME_PATH } from "./api";

export const SIGN_IN_HREF = "/signin?return_to=/start";

/**
 * Draft default is on. Set VITE_AUTH_GATE=false at build time to show /start
 * without a session while auth is not live.
 */
export function authGateEnabled(raw?: string): boolean {
  const value = raw === undefined ? import.meta.env.VITE_AUTH_GATE : raw;
  if (value === undefined || value === "") return true;
  return value !== "false" && value !== "0";
}

export function startHref(gateEnabled: boolean, signedIn: boolean): string {
  if (!gateEnabled || signedIn) return "/start";
  return SIGN_IN_HREF;
}

export type StartAction = "loading" | "form" | "redirect" | "unavailable";

export function startPageAction(
  gateEnabled: boolean,
  meStatus: number | "loading" | "error",
): StartAction {
  if (!gateEnabled) return "form";
  if (meStatus === "loading") return "loading";
  if (meStatus === 200) return "form";
  if (meStatus === 401) return "redirect";
  return "unavailable";
}

export function signInHrefFor(returnTo: "/start" | "/account"): string {
  return `/signin?return_to=${returnTo}`;
}

export interface MeOk {
  ok: true;
  user: unknown;
  csrf: string;
}

export interface MeFail {
  ok: false;
  status: number;
}

export async function fetchMe(fetchImpl: typeof fetch = fetch): Promise<MeOk | MeFail> {
  const response = await fetchImpl(ME_PATH, { credentials: "same-origin" });
  if (response.status !== 200) return { ok: false, status: response.status };
  const body = (await response.json()) as { user?: unknown; csrf?: unknown };
  if (typeof body.csrf !== "string" || body.csrf.length === 0) {
    return { ok: false, status: response.status };
  }
  return { ok: true, user: body.user, csrf: body.csrf };
}
