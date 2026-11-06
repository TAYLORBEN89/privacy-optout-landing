/**
 * Response headers for the DROP Texas apex site (droptexas.com).
 *
 * Strict-Transport-Security matches a GET of https://accounts.droptexas.com/signin:
 * max-age=31536000; includeSubDomains. That response does not send preload.
 *
 * These are applied to HTML and static asset responses from this Worker.
 * They are not applied to /api responses, so the accounts proxy is unchanged.
 */

/** Live accounts host value. No preload. */
export const STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains";

export const X_FRAME_OPTIONS = "DENY";

export const X_CONTENT_TYPE_OPTIONS = "nosniff";

/**
 * Vite/React apex, not the accounts sign-in card.
 *
 * The built page loads one same-origin module (`/assets/*.js`) and one
 * same-origin stylesheet (`/assets/*.css`). Images, icons, and the OG image
 * are same-origin. CSS also uses data:image/svg+xml backgrounds. Fonts are
 * the system stack only. Runtime fetches are same-origin `/api/*`.
 * Production analytics is a no-op and does not call a third party.
 *
 * script-src is 'self' only. The accounts host uses script-src 'none' because
 * its sign-in card has no JavaScript; that would block this app. There is no
 * unsafe-eval and no unsafe-inline. The only inline script in the HTML is
 * schema.org JSON-LD (`application/ld+json`). It is not app code, so it is
 * not granted unsafe-inline. The React app does not need it to run.
 *
 * style-src is 'self' only. The document has no style attributes and no
 * style elements. Account step-up and identity linking submit a real form to
 * this origin or https://accounts.droptexas.com, so form-action allows those
 * two and nothing else. Top-level links to statutes and broker sites are
 * navigations, not fetches, and are left unrestricted.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self'",
  "style-src-attr 'none'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self' https://accounts.droptexas.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "worker-src 'none'",
  "manifest-src 'none'",
  "media-src 'none'",
].join("; ");

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/** Sets the apex security headers on a copied header list. */
export function applyApexSecurityHeaders(headers: Headers): void {
  headers.set("strict-transport-security", STRICT_TRANSPORT_SECURITY);
  headers.set("x-frame-options", X_FRAME_OPTIONS);
  headers.set("x-content-type-options", X_CONTENT_TYPE_OPTIONS);
  headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
}

/**
 * Returns a new response with the apex security headers.
 * 304 and other null-body statuses keep a null body.
 */
export function withApexSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  applyApexSecurityHeaders(headers);
  const body = NULL_BODY_STATUSES.has(response.status) ? null : response.body;
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
