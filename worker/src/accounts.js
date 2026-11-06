// accounts.droptexas.com (ACCOUNTS_HOST): the sign-in host. Same Worker, selected by the request Host.
// Routes: GET /signin, GET /oauth/{google,microsoft}/start?st=, GET /oauth/{google,microsoft}/callback,
// POST /oauth/{google,microsoft}/bound (form st=, from the app origin). HEAD and everything else: 405/404.
// This host never reads or sets __Host-sid; it only holds the __Host-oauth state cookie and hands the result to the
// app origin with a single-use 60 s code (see api.js complete()).
import { accountsStart, callback, appOrigin, accountsOrigin } from './api.js';
import { safeReturnTo } from './oauth.js';
import { b64 } from './crypto.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', // the handoff code is in a URL; never leak it via Referer
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store',
};
const csp = (nonce) => `default-src 'none'; style-src 'nonce-${nonce}'; img-src 'self'; script-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`;

const secure = (res, nonce = b64(crypto.getRandomValues(new Uint8Array(16)))) => {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  out.headers.set('Content-Security-Policy', csp(nonce));
  return out;
};
const notFound = () => secure(new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Official brand marks, inline so the CSP (img-src 'self', style-src nonce-only) needs no change. Colors are the
// brands' own and must not be altered. Presentation attributes only (no style=""), aria-hidden: the visible text
// is the accessible name.
const GOOGLE_G = '<svg class="logo" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">'
  + '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
  + '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
  + '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
  + '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>'
  + '</svg>';
const MS_SQUARES = '<svg class="logo" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">'
  + '<rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>'
  + '<rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/>'
  + '</svg>';

function signinPage(env, returnTo, nonce) {
  const rt = encodeURIComponent(returnTo);
  const app = esc(appOrigin(env));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Sign in · DROP Texas</title>
<style nonce="${nonce}">
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f7f9;color:#111;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border:1px solid #e3e5e8;border-radius:12px;padding:32px;width:100%;max-width:360px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 24px;color:#555;font-size:14px}
a.btn{display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 12px;border:1px solid #747775;border-radius:8px;background:#fff;color:#1f1f1f;text-decoration:none;font-weight:600;margin-bottom:12px}
a.btn:hover{background:#f2f3f5}a.btn .logo{flex:none;width:20px;height:20px}
</style></head>
<body><main>
<h1>DROP Texas</h1><p>Sign in to your account</p>
<a class="btn" href="${app}/api/auth/google/start?return_to=${rt}">${GOOGLE_G}<span>Sign in with Google</span></a>
<a class="btn" href="${app}/api/auth/microsoft/start?return_to=${rt}">${MS_SQUARES}<span>Sign in with Microsoft</span></a>
</main></body></html>`;
}

export async function handleAccounts(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const origin = req.headers.get('Origin');
  const ctx = { req, env, origin: null };
  // POST /oauth/{p}/bound: the step-up/link form, submitted top-level from the app origin only.
  const b = path.match(/^\/oauth\/(google|microsoft)\/bound$/);
  if (b) {
    if (req.method !== 'POST') return secure(new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } }));
    if (origin !== appOrigin(env)) return secure(new Response('Forbidden origin', { status: 403 }));
    return secure(await accountsStart(ctx, b[1], 'post'));
  }
  // Everything else: GET only (HEAD -> 405 without touching tokens or rate limits); same-site or no Origin.
  if (origin && origin !== accountsOrigin(env)) return secure(new Response('Forbidden origin', { status: 403 }));
  if (req.method !== 'GET') return secure(new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } }));

  if (path === '/' ) return secure(new Response(null, { status: 302, headers: { Location: '/signin' } }));
  if (path === '/signin') {
    const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
    const html = signinPage(env, safeReturnTo(url.searchParams.get('return_to')), nonce);
    return secure(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }), nonce);
  }
  const m = path.match(/^\/oauth\/(google|microsoft)\/(start|callback)$/);
  if (!m) return notFound();
  return secure(m[2] === 'start' ? await accountsStart(ctx, m[1], 'get') : await callback(ctx, m[1]));
}
