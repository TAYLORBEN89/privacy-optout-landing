# Social sign-in setup (Google, Microsoft)

Only Google and Microsoft are supported (Apple sign-in was removed), plus the email + password + TOTP fallback.

Sign-in runs on **`accounts.droptexas.com`** (like accounts.google.com), served by the same Worker
`privacy-dashboard-api`, which branches on the request `Host`. The session cookie and the API stay on `droptexas.com`.

| Provider  | Redirect URI to register (exact)                              | Method |
|-----------|---------------------------------------------------------------|--------|
| Google    | `https://accounts.droptexas.com/oauth/google/callback`        | GET    |
| Microsoft | `https://accounts.droptexas.com/oauth/microsoft/callback`     | GET    |

The same two URIs are `OAUTH_REDIRECT_URIS` in `worker/wrangler.toml` (`npm run check:origins` enforces them).

### Flow
1. `droptexas.com/api/auth/{google,microsoft}/start?return_to=/account` → 302 to
   `accounts.droptexas.com/oauth/{provider}/start` (or the user opens `accounts.droptexas.com/signin`).
2. The accounts host sets the sealed `__Host-oauth` state cookie (host-only, accounts host only) and redirects to the provider.
3. `accounts.droptexas.com/oauth/{provider}/callback` verifies state/PKCE/nonce/ID token, then creates a random
   **handoff code** (single use, 60 s; only its SHA-256 is stored in D1 `auth_handoffs`, bound to user, intent and
   return_to) and 302s to `https://droptexas.com/api/auth/complete?code=…`.
4. `droptexas.com/api/auth/complete` redeems the code once, sets the host-only `__Host-sid` on `droptexas.com`
   (no `Domain=` cookie anywhere) and redirects to the allowlisted `return_to` (`/start`, `/start#step-N`, `/account`).
   Reuse, expiry, tampering and wrong-host requests are refused; redemptions are rate-limited (30/10 min/IP) and audited.
5. Step-up and link: the apex (authenticated) returns `{url}` pointing at the accounts host with a sealed, single-use,
   120-second **intent token** bound to the user and session. The accounts host never reads `__Host-sid`. Step-up is
   applied at redemption only if the browser presents that same apex session.

### Routes
- accounts.droptexas.com (GET only; `Origin`, if present, must be `https://accounts.droptexas.com`):
  `/signin`, `/oauth/{google,microsoft}/start`, `/oauth/{google,microsoft}/callback`. Everything else 404.
  Headers: CSP `default-src 'none'; style-src 'nonce-…'; script-src 'none'; form-action 'none'; base-uri 'none';
  frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, HSTS.
- droptexas.com: `GET /api/auth/{provider}/start` (302 to accounts), `GET /api/auth/complete`,
  `POST /api/auth/{provider}/stepup` and `POST /api/account/identities/{provider}/link` (return `{url}` on the accounts host).
  The old `/api/auth/{provider}/callback` paths return 404. API origins stay `droptexas.com` and `www.droptexas.com`.

### Custom domain (not attached)
`wrangler.toml` has a commented `[[routes]]` entry `pattern = "accounts.droptexas.com"`, `custom_domain = true`.
Uncommenting it and deploying creates the DNS record for the subdomain, so it happens only at deploy with the owner's yes.

## 1. Google
1. Google Cloud Console → APIs & Services → OAuth consent screen: External, app name "DROP Texas", support email,
   authorized domain `droptexas.com` (covers accounts.droptexas.com), scopes `openid`, `email`, `profile` only (no verification review needed for these).
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorized redirect URI: `https://accounts.droptexas.com/oauth/google/callback`. No JavaScript origins are needed.
4. Put the client ID in `GOOGLE_CLIENT_ID` ([vars]) and run `npx wrangler secret put GOOGLE_CLIENT_SECRET`.
5. Publish the consent screen (move out of "Testing") before launch, or only test users can sign in.

## 2. Microsoft (Entra ID, personal + work/school accounts)
1. Entra admin center → App registrations → New registration, name "DROP Texas".
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (multi-tenant + consumer; the Worker uses the `/common` endpoint).
3. Redirect URI: platform **Web**, `https://accounts.droptexas.com/oauth/microsoft/callback`.
4. Certificates & secrets → New client secret → copy the **Value** → `npx wrangler secret put MICROSOFT_CLIENT_SECRET`. Note its expiry date and rotate before it lapses.
5. Token configuration → Add optional claim → ID token → `email` and **`xms_edov`** (email domain owner verified). Emails are marked verified **only** when the token carries `xms_edov=true`; otherwise (including personal Microsoft accounts) they are stored as *unverified*.
6. API permissions: `openid`, `email`, `profile` (Microsoft Graph, delegated) — default.
7. Put the Application (client) ID in `MICROSOFT_CLIENT_ID` ([vars]).

## 3. Shared secret
`OAUTH_COOKIE_KEY`: `openssl rand -base64 32` → `npx wrangler secret put OAUTH_COOKIE_KEY`. Rotating it only invalidates
sign-ins that are in progress (10-minute window).

## 4. Deploy checklist (needs owner approval)
1. `npx wrangler d1 migrations apply DB --remote` (applies `0007_social_auth.sql`: adds tables/columns only, no rebuilds).
2. Set all secrets above, plus the existing `TOTP_ENC_KEY`, `PII_ENC_KEY`, `API_TOKEN`.
3. Replace the placeholder client IDs and `OAUTH_REDIRECT_URIS` in `wrangler.toml`.
4. Confirm the site Worker forwards `/api/*` to this Worker (service binding) and keeps the request host, and attach
   `accounts.droptexas.com` as a Custom Domain of this Worker (creates its DNS record; owner approval).
5. `SESSION_COOKIE_SAMESITE = "Lax"` (already set): needed because the provider redirect back is a cross-site navigation.

## Local development
Copy `worker/.dev.vars.example` to `worker/.dev.vars` (gitignored) and put fake or dev-app values there; dev origins (localhost, pages.dev) live only there. `npm run check:origins` fails if production `ALLOWED_ORIGIN` contains anything but `https://droptexas.com,https://www.droptexas.com`. Tests use generated throwaway keys and mock the
provider token/JWKS endpoints; they never contact Google or Microsoft.

## Step-up (re-authentication)
Sensitive actions (export, delete, session revoke, identifier reads/writes, linking, and the legacy `/profile` and
`/optouts/:id/pii` routes) need a step-up within the last 10 minutes. Google/Microsoft step-up and link requests send
`prompt=login` and `max_age=0`, and the callback refuses the result unless the ID token has a numeric `auth_time` no
older than 600 seconds. Password + TOTP is the other step-up route.
