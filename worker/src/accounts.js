// accounts.droptexas.com (ACCOUNTS_HOST): the sign-in host. Same Worker, selected by the request Host.
// Routes (GET only): /signin, /oauth/{google,microsoft}/start, /oauth/{google,microsoft}/callback. Everything else 404.
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
a.btn{display:block;text-align:center;padding:12px;border:1px solid #c9ccd1;border-radius:8px;color:#111;text-decoration:none;font-weight:600;margin-bottom:12px}
a.btn:hover{background:#f2f3f5}.alt{font-size:13px;text-align:center;margin-top:16px}.alt a{color:#1a56db}
</style></head>
<body><main>
<h1>DROP Texas</h1><p>Sign in to your account</p>
<a class="btn" href="/oauth/google/start?return_to=${rt}">Continue with Google</a>
<a class="btn" href="/oauth/microsoft/start?return_to=${rt}">Continue with Microsoft</a>
<div class="alt"><a href="${app}/account">Use email, password and authenticator code instead</a></div>
</main></body></html>`;
}

export async function handleAccounts(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  // Only same-site (accounts) or no Origin; the app/API origins are not allowed to drive this host.
  const origin = req.headers.get('Origin');
  if (origin && origin !== accountsOrigin(env)) return secure(new Response('Forbidden origin', { status: 403 }));
  if (req.method !== 'GET' && req.method !== 'HEAD') return secure(new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } }));
  const ctx = { req, env, origin: null };

  if (path === '/' ) return secure(new Response(null, { status: 302, headers: { Location: '/signin' } }));
  if (path === '/signin') {
    const nonce = b64(crypto.getRandomValues(new Uint8Array(16)));
    const html = signinPage(env, safeReturnTo(url.searchParams.get('return_to')), nonce);
    return secure(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }), nonce);
  }
  const m = path.match(/^\/oauth\/(google|microsoft)\/(start|callback)$/);
  if (!m) return notFound();
  return secure(m[2] === 'start' ? await accountsStart(ctx, m[1]) : await callback(ctx, m[1]));
}
