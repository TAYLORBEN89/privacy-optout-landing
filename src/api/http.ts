import { apiUrl } from "../api";
import { isStepUpRequired } from "./stepUp";

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  status: number;
  stepUp: boolean;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<ApiOk<T> | ApiErr> {
  let response: Response;
  try {
    response = await fetchImpl(apiUrl(path), { ...init, credentials: "same-origin" });
  } catch {
    return { ok: false, status: 0, stepUp: false };
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, status: response.status, stepUp: isStepUpRequired(response.status, data) };
  }
  return { ok: true, data: data as T };
}

export function csrfHeaders(csrfToken: string): HeadersInit {
  return {
    "content-type": "application/json",
    "X-CSRF-Token": csrfToken,
  };
}
