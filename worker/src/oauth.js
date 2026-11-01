// OAuth 2.0 / OIDC for Google and Microsoft using `arctic` (auth-code flow) + `jose` (ID token verification).
// Design (approved): auth code + PKCE (Google, Microsoft) + OIDC nonce; ID tokens verified against the provider JWKS
// (iss, aud, exp, iat, nonce). Provider access/refresh tokens are never stored or logged.
import { Google, MicrosoftEntraId, generateState, generateCodeVerifier } from 'arctic';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { b64, unb64, randomBytes } from './crypto.js';

export const PROVIDERS = ['google', 'microsoft'];
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const JWKS_URL = {
  google: 'https://www.googleapis.com/oauth2/v3/certs',
  microsoft: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
};
const jwksCache = {};
const jwks = (p) => (jwksCache[p] ??= createRemoteJWKSet(new URL(JWKS_URL[p]), { cooldownDuration: 30000, cacheMaxAge: 3600000 }));

// ---------- redirect_uri allowlist ----------
// OAUTH_REDIRECT_URIS: comma-separated exact URIs, e.g. https://privacy-api.example.com/api/auth/google/callback.
// The URI used must match the request origin and the provider's callback path exactly.
export function redirectUriFor(env, provider, reqUrl) {
  const want = `${new URL(reqUrl).origin}/api/auth/${provider}/callback`;
  const list = String(env.OAUTH_REDIRECT_URIS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(want) ? want : null;
}

export function client(env, provider, redirectUri) {
  if (provider === 'google') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
    return new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  }
  if (provider === 'microsoft') {
    if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) return null;
    return new MicrosoftEntraId('common', env.MICROSOFT_CLIENT_ID, env.MICROSOFT_CLIENT_SECRET, redirectUri);
  }
  return null;
}
export const clientIdFor = (env, p) => ({ google: env.GOOGLE_CLIENT_ID, microsoft: env.MICROSOFT_CLIENT_ID }[p]);

// Builds the provider authorization URL. reauth=true forces fresh authentication (step-up).
export function authorizationUrl(c, provider, { state, verifier, nonce, reauth }) {
  const url = c.createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']);
  url.searchParams.set('nonce', nonce);
  if (reauth) {
    // Force fresh authentication; the callback additionally requires auth_time within 600 s.
    url.searchParams.set('max_age', '0');
    url.searchParams.set('prompt', 'login');
  }
  return url;
}

export const newFlowSecrets = () => ({ state: generateState(), verifier: generateCodeVerifier(), nonce: generateState() });

export async function exchange(c, provider, code, verifier) {
  const tokens = await c.validateAuthorizationCode(code, verifier);
  return tokens.idToken(); // only the ID token is used; access/refresh tokens are dropped here
}

const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1';

export class IdTokenError extends Error { constructor(reason) { super(reason); this.reason = reason; } }

// Verifies signature (JWKS), alg, aud, exp, iat (with 5 min skew), issuer rules and nonce. Returns a normalized identity.
export async function verifyIdToken(env, provider, idToken, nonce) {
  let payload;
  try {
    const opts = { audience: clientIdFor(env, provider), algorithms: ['RS256'], clockTolerance: 300, requiredClaims: ['iat', 'exp', 'sub'] };
    if (provider === 'google') opts.issuer = ['https://accounts.google.com', 'accounts.google.com'];
    ({ payload } = await jwtVerify(idToken, jwks(provider), opts));
  } catch (e) {
    const code = e?.code || '';
    throw new IdTokenError(code === 'ERR_JWT_EXPIRED' ? 'token_expired'
      : code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' ? (e.claim === 'aud' ? 'bad_aud' : e.claim === 'iss' ? 'bad_iss' : 'bad_claims')
        : 'bad_signature');
  }
  const t = Math.floor(Date.now() / 1000);
  if (typeof payload.iat !== 'number' || payload.iat > t + 300) throw new IdTokenError('bad_claims');
  if (typeof payload.nonce !== 'string' || payload.nonce !== nonce) throw new IdTokenError('nonce_mismatch');

  if (provider === 'microsoft') {
    // Multi-tenant (/common): iss must be exactly the tid-specific issuer.
    const tid = payload.tid;
    if (typeof tid !== 'string' || !GUID.test(tid) || payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) throw new IdTokenError('bad_iss');
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    // Verified only when Microsoft asserts domain-owner verification (xms_edov); no consumer-tenant shortcut.
    return { sub: `${tid}:${payload.sub}`, email, emailVerified: !!email && truthy(payload.xms_edov), authTime: payload.auth_time };
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  return { sub: String(payload.sub), email, emailVerified: !!email && truthy(payload.email_verified), authTime: payload.auth_time };
}

// ---------- sealed state cookie (__Host-oauth) ----------
// AES-GCM with OAUTH_COOKIE_KEY (base64, 32 bytes). Payload binds provider, state, PKCE verifier, nonce, return_to,
// intent and (for link/step-up) the session. 10-minute TTL; single use is enforced server-side (oauth_states_used).
export const OAUTH_COOKIE = '__Host-oauth';
export const OAUTH_TTL = 600;
const AAD = new TextEncoder().encode('oauth-state:v1');
async function cookieKey(env) {
  const raw = env.OAUTH_COOKIE_KEY ? unb64(env.OAUTH_COOKIE_KEY) : new Uint8Array();
  if (raw.length !== 32) throw new Error('OAUTH_COOKIE_KEY must be 32 bytes (base64)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64url = (s) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

export async function sealState(env, data) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await cookieKey(env),
    new TextEncoder().encode(JSON.stringify({ ...data, e: Math.floor(Date.now() / 1000) + OAUTH_TTL })));
  return `${b64url(b64(iv))}.${b64url(b64(ct))}`;
}
export async function openState(env, sealed) {
  try {
    const [iv, ct] = String(sealed).split('.');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64url(iv), additionalData: AAD }, await cookieKey(env), unb64url(ct));
    const d = JSON.parse(new TextDecoder().decode(pt));
    return d.e > Math.floor(Date.now() / 1000) ? d : null;
  } catch { return null; }
}
// SameSite=Lax: the provider redirect back is a top-level GET navigation, so the cookie is sent.
export const oauthCookie = (v) => `${OAUTH_COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${OAUTH_TTL}`;
export const clearOauthCookie = () => `${OAUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export function readOauthCookie(req) {
  const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)__Host-oauth=([A-Za-z0-9_.-]+)/);
  return m ? m[1] : null;
}

// return_to allowlist: /start, /start#step-N, /account. Anything else -> /start.
export function safeReturnTo(v) {
  const s = typeof v === 'string' ? v : '';
  return s === '/start' || s === '/account' || /^\/start#step-[1-9][0-9]?$/.test(s) ? s : '/start';
}

