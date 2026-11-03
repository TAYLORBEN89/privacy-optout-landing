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

// Footer: mirrors the landing site's footer (FOOTER_DESKTOP_ROWS / FOOTER_GROUPS / FOOTER_COPYRIGHT / DISCLAIMER).
// Keep in sync with src/footerLinks.ts and src/copy.ts on the landing site. Links are absolute to the app origin.
export const FOOTER_ROWS = [
  [['Overview', '/overview'], ['How It Works', '/how-it-works'], ['Data Brokers', '/data-brokers'], ['Brokers list', '/brokers'], ['TDPSA', '/tdpsa'], ['Help', '/help']],
  [['About', '/about'], ['Share', '/share'], ['Start', '/start'], ['Privacy', '/privacy'], ['Security', '/security']],
];
const FOOTER_GROUPS = [
  ['Explore DROP Texas', [['Overview', '/overview'], ['How It Works', '/how-it-works'], ['Personal Information', '/personal-information'], ['Data Brokers', '/data-brokers'], ['Unique Identifiers', '/unique-identifiers']]],
  ['Learn', [['TDPSA', '/tdpsa'], ['Brokers', '/brokers']]],
  ['Company', [['About', '/about'], ['Share', '/share']]],
  ['Help', [['Help', '/help'], ['Start', '/start']]],
  ['Security and Privacy', [['Privacy', '/privacy'], ['Security', '/security']]],
];
export const FOOTER_COPYRIGHT = '© 2026 DROP Texas. All rights reserved.';
export const DISCLAIMER = 'DROP Texas is an independent, free service run by a private enterprise. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.';
const MARK = '<svg class="mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#ee0014"/><path fill="#ffffff" d="M11.2 14.2V11.6a4.8 4.8 0 0 1 9.6 0v2.6h-2.4V11.6a2.4 2.4 0 0 0-4.8 0v2.6h-2.4z"/><rect x="8" y="14" width="16" height="12" rx="2" fill="#ffffff"/></svg>';
const FOOTER_CSS = `footer.site-footer{width:100%;background:#f5f6f8}
.footer-accordion{border-top:1px solid #e4e6ea}.footer-accordion details+details{border-top:1px solid #e4e6ea}
.footer-accordion summary{display:flex;align-items:center;justify-content:space-between;min-height:64px;box-sizing:border-box;padding:18px 20px;color:#010101;font-size:20px;line-height:1.3;cursor:pointer;list-style:none}
.footer-accordion summary::-webkit-details-marker{display:none}
.footer-accordion summary::after{content:"";flex:none;width:8px;height:8px;margin-right:4px;border-right:1.5px solid #010101;border-bottom:1.5px solid #010101;transform:rotate(45deg);transition:transform .2s ease}
.footer-accordion details[open] summary::after{transform:rotate(225deg)}
.footer-accordion summary:focus-visible{outline:3px solid #1a56db;outline-offset:-3px}
.footer-accordion ul{margin:0;padding:0 20px 16px;list-style:none}.footer-accordion li+li{margin-top:10px}
.footer-accordion a{color:#3c3c3c;font-size:16px;text-decoration:none}.footer-accordion a:hover{text-decoration:underline}
.footer-rows{display:none}
.footer-dark{padding:40px 24px 48px;background:#0c1220;color:#fff;text-align:center}
.footer-dark .brand{display:flex;align-items:center;justify-content:center;gap:10px;margin:0;color:#fff;font-weight:700;font-size:18px}
.footer-dark .footer-copy{margin:16px 0 0;color:#fff;font-size:14px}
.footer-dark .independence{max-width:40rem;margin:14px auto 0;color:rgba(255,255,255,.78);font-size:14px;line-height:1.5}
@media (min-width:900px){.footer-accordion{display:none}.footer-rows{display:block;padding:36px 24px 28px}
.footer-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;margin:0;color:#3c3c3c;font-size:14px;line-height:1.6}
.footer-row+.footer-row{margin-top:8px}.footer-pipe{margin:0 10px;color:#b0b0b0}
.footer-row a{color:#010101;text-decoration:none}.footer-row a:hover{text-decoration:underline}}`;

function footerHtml(app) {
  const a = ([label, href]) => `<a href="${app}${href}">${esc(label)}</a>`;
  const groups = FOOTER_GROUPS.map(([t, links]) => `<details><summary>${esc(t)}</summary><ul>${links.map((l) => `<li>${a(l)}</li>`).join('')}</ul></details>`).join('');
  const rows = FOOTER_ROWS.map((r) => `<p class="footer-row">${r.map(a).join('<span class="footer-pipe" aria-hidden="true">|</span>')}</p>`).join('');
  return `<footer class="site-footer"><div class="footer-accordion">${groups}</div><nav class="footer-rows" aria-label="Footer">${rows}</nav>
<div class="footer-dark"><p class="brand">${MARK}<span>DROP Texas</span></p><p class="footer-copy">${esc(FOOTER_COPYRIGHT)}</p><p class="independence">${esc(DISCLAIMER)}</p></div></footer>`;
}

function signinPage(env, returnTo, nonce) {
  const rt = encodeURIComponent(returnTo);
  const app = esc(appOrigin(env));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Sign in · DROP Texas</title>
<style nonce="${nonce}">
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f7f9;color:#111;display:flex;flex-direction:column;min-height:100vh}
.wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 16px;box-sizing:border-box}
main{background:#fff;border:1px solid #e3e5e8;border-radius:12px;padding:32px;width:100%;max-width:360px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 24px;color:#555;font-size:14px}
a.btn{display:block;text-align:center;padding:12px;border:1px solid #c9ccd1;border-radius:8px;color:#111;text-decoration:none;font-weight:600;margin-bottom:12px}
a.btn:hover{background:#f2f3f5}.alt{font-size:13px;text-align:center;margin-top:16px}.alt a{color:#1a56db}
${FOOTER_CSS}
</style></head>
<body><div class="wrap"><main>
<h1>DROP Texas</h1><p>Sign in to your account</p>
<a class="btn" href="${app}/api/auth/google/start?return_to=${rt}">Continue with Google</a>
<a class="btn" href="${app}/api/auth/microsoft/start?return_to=${rt}">Continue with Microsoft</a>
<div class="alt"><a href="${app}/account">Use email, password and authenticator code instead</a></div>
</main></div>
${footerHtml(app)}
</body></html>`;
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
