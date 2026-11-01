// Session-based API client for the D1 auth routes. Uses the HttpOnly session cookie (credentials: 'include')
// and sends the per-session CSRF token on every state-changing request. The CSRF token is kept in memory only.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let csrf = '';
export const setCsrf = (t) => { csrf = t || ''; };

export class ApiError extends Error {
  constructor(status, body) { super(body?.error || `API ${status}`); this.status = status; this.body = body; }
}

export async function call(path, { method = 'GET', body } = {}) {
  if (!API_URL) throw new Error('VITE_API_URL not set');
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

export const login = (email, password) => call('/auth/login', { method: 'POST', body: { email, password } });
export const verify = (preauth_token, code) => call('/auth/totp/verify', { method: 'POST', body: { preauth_token, code } });
export const me = () => call('/me');
export const enroll = () => call('/auth/totp/enroll', { method: 'POST' });
export const confirmTotp = (code) => call('/auth/totp/confirm', { method: 'POST', body: { code } });
export const regenerateBackupCodes = () => call('/auth/backup-codes/regenerate', { method: 'POST' });
export const logout = () => call('/auth/logout', { method: 'POST' }).finally(() => setCsrf(''));
