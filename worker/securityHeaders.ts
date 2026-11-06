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
 * SHA-256, standard base64, of each inline JSON-LD script body.
 * shared/seo.ts jsonScript() writes `<script type="application/ld+json">`
 * into every page. scripts/prerender-seo.mjs persists that head, including
 * the /help FAQ graph. These digests are of the JSON text inside the tag,
 * in SEO_PAGES order, and match a fresh production build of those 26 files.
 * script-src lists them so the asset layer and the Worker allow the same blocks.
 */
const JSON_LD_SCRIPT_HASHES = [
  "o6SYMX4dTQ8KLoACTB/DPa2BhYqImFS/D7TFm3AHYhI=",
  "fLaJH4SjbzTbHvBc/M1+cr2ZBzsTdyfTnGZYkpNW+9w=",
  "U3I3f22AbsmuPi+fR4K8v5C3ISWLm6yZumzYfF9ytvw=",
  "WRkGTCIAkKnCJ6PnO59EIQPWow4laFESGeDB5GWzZtM=",
  "ZocDnEfi/YldAvXT2DygNWzF23NxAEHOTtrSOG/2+Eg=",
  "qLD8/69nvKpLnoDTIwquhknyQfwhFkUYLyd0Auk/vTE=",
  "MvSgV6ZXj56xsaqLwSVfLDpNjE+2G7+Cuf/9dRnuMVU=",
  "w9QjwBAhyE4fL1O8Og9bl5fYBeP4ptKLzStd0Kiobd4=",
  "UDxmZ5hCuJQdL+hH8/u0UybwR3vtiThgf8ideWthEyY=",
  "XHenqLRLtW1TYPqhA/FRQ1nEnuy7+80WJmevANB6JmI=",
  "35tll/OquCtYwD+eK/2XRAR31+Fp+XBsNtdH7W36tGM=",
  "f9Gfzk+8w2uAaha7IaLkziVEjdx6E5SyMErTUp5EIZM=",
  "mnpGvEcItSVDFBykWpIgbEDh9RbjfdTo+d0IJ8oIJ3I=",
  "sII211KzdnkiHF95yd9mC7KiaRN00AyvUrb8FyPFaXU=",
  "qrmPZUVTb2ZNcrsZnEWZTw4wCR99f6Ovea6+aGsHUA0=",
  "iOQUoVLexx9uS7i9mzv5Y9sm/pWxYVaTF5wD3ZFfoiQ=",
  "SFQUR9j4A9LwlxQbQfbIrQtgjkjX1V2NxsDSzOFk8WU=",
  "uKdLzVWgQOTPHevhRS7aL+A7TmWu43uru5dNxnckdZY=",
  "D5lUDJpx/Gs1f9teu6ZIZS4rTqdztQGDRvBCl0lyS30=",
  "Ygykb5os2F2Qq7R3NNQpNqZj4m5H7luA2VaBgzUfDxQ=",
  "X+UNqkkXEwb38vOuGMLvAsI8uLc6iOl/BhRrVunwZRg=",
  "7/7v5KORdGTN5axH3RaBH3pNbO1ep06GjceYtCsRxL0=",
  "bHPcmzHibHekOWkN6NdghqvSIq2gK6hKKR6xoGcc1AQ=",
  "fDW/Y5VRC8k/QMoZVaoOR9P+g9d1Z84H+NYPocVSy2g=",
  "r3MAx70yopDl3vrrK7icLKsQoNutyqp/ILgZbepPo4E=",
  "QquxqEIZouGB524+RboFzgpEEVSzsPyK96RxYAoaQec=",
] as const;

const JSON_LD_SCRIPT_SOURCES = JSON_LD_SCRIPT_HASHES.map((hash) => `'sha256-${hash}'`).join(" ");

/**
 * Vite/React apex, not the accounts sign-in card.
 *
 * The built page loads one same-origin module (`/assets/*.js`) and one
 * same-origin stylesheet (`/assets/*.css`). Images, icons, and the OG image
 * are same-origin. CSS also uses data:image/svg+xml backgrounds. Fonts are
 * the system stack only. Runtime fetches are same-origin `/api/*`.
 * Production analytics is a no-op and does not call a third party.
 *
 * script-src is 'self' plus one hash per inline JSON-LD block above. The
 * accounts host uses script-src 'none' because its sign-in card has no
 * JavaScript; that would block this app's module. There is no unsafe-eval
 * and no unsafe-inline. The hashes allow the existing structured data
 * without opening other inline scripts.
 *
 * style-src is 'self' only. The document has no style attributes and no
 * style elements. Account step-up and identity linking submit a real form to
 * this origin or https://accounts.droptexas.com, so form-action allows those
 * two and nothing else. Top-level links to statutes and broker sites are
 * navigations, not fetches, and are left unrestricted.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' ${JSON_LD_SCRIPT_SOURCES}`,
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
