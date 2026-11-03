// Session-based API client for the D1 auth routes. Uses the HttpOnly session cookie (credentials: 'include')
// and sends the per-session CSRF token on every state-changing request. The CSRF token is kept in memory only.
// Same-origin plan: leave VITE_API_URL empty and the app calls /api/* on its own origin.
const API_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');
let csrf = '';
export const setCsrf = (t) => { csrf = t || ''; };

export class ApiError extends Error {
  constructor(status, body, retryAfter = null) { super(body?.error || `API ${status}`); this.status = status; this.body = body; this.retryAfter = retryAfter; }
}

async function send(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = csrf;
  const res = await fetch(API_URL + path, {
    method, headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (data?.csrf_token) setCsrf(data.csrf_token);
  if (!res.ok) throw new ApiError(res.status, data, Number(res.headers.get('Retry-After')) || null);
  return data;
}

// TOTP upgrade for a session that is signed in but must still pass TOTP (any sign-in method, once TOTP is
// enrolled): the server answers 403 {code:'mfa_required'}. The UI registers `ask(message)` -> Promise<code|null>;
// call() then prompts, POSTs the code to /api/auth/mfa/verify (which rotates the session and CSRF token) and
// retries the original request once. A bad code and a 429 get the same message and a fresh prompt; null cancels.
export const MFA_PATH = '/api/auth/mfa/verify';
export const MFA_RETRY_MESSAGE = "That code didn't work, or there were too many tries. Wait a minute and try again.";
let askMfa = null;
let pendingUpgrade = null; // one prompt at a time, shared by concurrent requests
export const setMfaPrompt = (fn) => { askMfa = fn; };
export const mfaVerify = (code) => send(MFA_PATH, { method: 'POST', body: { code } });
const isMfaRequired = (e) => e instanceof ApiError && e.status === 403 && (e.body?.code === 'mfa_required' || e.body?.error === 'mfa required');

async function upgrade() {
  let message = '';
  for (;;) {
    const code = await askMfa(message);
    if (code == null) return false;
    try { await mfaVerify(String(code).trim()); return true; }
    catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 429)) { message = MFA_RETRY_MESSAGE; continue; }
      throw e;
    }
  }
}

export async function call(path, opts = {}) {
  try { return await send(path, opts); }
  catch (e) {
    if (!isMfaRequired(e) || !askMfa || path === MFA_PATH) throw e;
    pendingUpgrade ||= upgrade().finally(() => { pendingUpgrade = null; });
    if (!(await pendingUpgrade)) throw e;
    return send(path, opts); // retried once with the upgraded session
  }
}

// Password + TOTP (fallback sign-in), same-origin aliases under /api/auth/*.
export const login = (email, password) => call('/api/auth/login', { method: 'POST', body: { email, password } });
export const verify = (preauth_token, code) => call('/api/auth/totp/verify', { method: 'POST', body: { preauth_token, code } });
export const enroll = () => call('/api/auth/totp/enroll', { method: 'POST' });
export const confirmTotp = (code) => call('/api/auth/totp/confirm', { method: 'POST', body: { code } });
export const regenerateBackupCodes = () => call('/api/auth/backup-codes/regenerate', { method: 'POST' });

// Social sign-in: full-page navigation to the provider.
export const PROVIDERS = [
  { id: 'google', label: 'Google' }, { id: 'microsoft', label: 'Microsoft' },
];
export const socialStartUrl = (provider, returnTo = '/account') =>
  `${API_URL}/api/auth/${provider}/start?return_to=${encodeURIComponent(returnTo)}`;

export const me = () => call('/api/me');
export const logout = () => call('/api/auth/logout', { method: 'POST' }).finally(() => setCsrf(''));

// Step-up (re-authentication, valid 10 minutes).
export const stepUpPassword = (password, code) => call('/api/auth/stepup/password', { method: 'POST', body: { password, code } });
export const stepUpProvider = (provider) => call(`/api/auth/${provider}/stepup`, { method: 'POST', body: { return_to: '/account' } });

// Account area.
export const getProfile = () => call('/api/account/profile');
export const patchProfile = (body) => call('/api/account/profile', { method: 'PATCH', body });
export const optouts = () => call('/api/account/optouts');
export const sessions = () => call('/api/account/sessions');
export const revokeSession = (id) => call(`/api/account/sessions/${id}/revoke`, { method: 'POST' });
// Step-up / link responses are {action, method:'POST', fields:{st}}: submit them as a top-level form POST so the
// session-bound start token never appears in a URL, history entry or Referer.
export function submitStart({ action, method, fields }) {
  const f = document.createElement('form');
  f.method = method || 'POST'; f.action = action;
  for (const [k, v] of Object.entries(fields || {})) {
    const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i);
  }
  document.body.appendChild(f); f.submit();
}
export const linkProvider = (provider) => call(`/api/account/identities/${provider}/link`, { method: 'POST', body: { return_to: '/account' } });
export const unlinkProvider = (provider) => call(`/api/account/identities/${provider}`, { method: 'DELETE' });
export const exportData = () => call('/api/account/export', { method: 'POST' }); // POST + CSRF (was GET)
export const deleteAccount = () => call('/api/account/delete', { method: 'POST' });
