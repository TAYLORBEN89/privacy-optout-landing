// Session-based API client for the D1 auth routes. Uses the HttpOnly session cookie (credentials: 'include')
// and sends the per-session CSRF token on every state-changing request. The CSRF token is kept in memory only.
// Same-origin plan: leave VITE_API_URL empty and the app calls /api/* on its own origin.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let csrf = '';
export const setCsrf = (t) => { csrf = t || ''; };

export class ApiError extends Error {
  constructor(status, body) { super(body?.error || `API ${status}`); this.status = status; this.body = body; }
}

export async function call(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = csrf;
  const res = await fetch(API_URL + path, {
    method, headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (data?.csrf_token) setCsrf(data.csrf_token);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
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
