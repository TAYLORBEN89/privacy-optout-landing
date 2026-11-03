// Tells the session-API auth failures apart. The Worker answers 401 {error:'unauthorized'} with no session,
// 403 {code:'mfa_required'} for a password session that has not finished TOTP, and 403 {code:'step_up_required'}
// when the route needs a recent re-authentication. Any other 403 (CSRF/origin) is 'forbidden'. These only happen
// after the session cookie is checked, so they reveal nothing about other accounts (no enumeration risk); the
// sign-in paths keep their uniform messages.
import { ApiError } from './authApi.js';

export const SIGNED_OUT = 'signed_out';
export const MFA_REQUIRED = 'mfa_required';
export const STEP_UP_REQUIRED = 'step_up_required';
export const FORBIDDEN = 'forbidden';

export class SessionAuthError extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}

/** reason string for a session auth failure, or null if `e` is not one (network, 5xx, 400, 429...). */
export function sessionReason(e) {
  if (!(e instanceof ApiError)) return null;
  if (e.status === 401) return SIGNED_OUT;
  if (e.status !== 403) return null;
  const c = e.body?.code || e.body?.error;
  if (c === 'mfa_required' || c === 'mfa required') return MFA_REQUIRED;
  if (c === 'step_up_required') return STEP_UP_REQUIRED;
  return FORBIDDEN;
}

export const SESSION_NOTES = {
  [SIGNED_OUT]: 'Sign in at #/account to load and save this. It is stored encrypted on the server, never in this browser.',
  [MFA_REQUIRED]: 'Finish two-step verification at #/account (enter your authenticator code) to load and save this.',
  [STEP_UP_REQUIRED]: 'For your security, confirm it is you again at #/account (re-authenticate), then reload this page.',
  [FORBIDDEN]: 'Your session could not be verified. Reload the page; if it keeps happening, sign out and back in.',
};
