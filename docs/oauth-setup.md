# Social sign-in setup (Google, Apple, Microsoft)

DROP Texas uses same-origin sign-in: the site forwards `/api/*` to the `privacy-dashboard-api` Worker, so every
provider redirects back to `https://droptexas.com/api/auth/{provider}/callback`. Register these exact URIs
(examples below use `privacy-api.example.com` for a staging host; swap in your own):

| Provider  | Redirect URI                                           | Method |
|-----------|--------------------------------------------------------|--------|
| Google    | `https://droptexas.com/api/auth/google/callback`       | GET    |
| Microsoft | `https://droptexas.com/api/auth/microsoft/callback`    | GET    |
| Apple     | `https://droptexas.com/api/auth/apple/callback`        | POST (form_post) |

The same list goes into `OAUTH_REDIRECT_URIS` in `worker/wrangler.toml` (comma-separated, exact match).

## 1. Google
1. Google Cloud Console → APIs & Services → OAuth consent screen: External, app name "DROP Texas", support email,
   authorized domain `droptexas.com`, scopes `openid`, `email`, `profile` only (no verification review needed for these).
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorized redirect URI: `https://droptexas.com/api/auth/google/callback`. No JavaScript origins are needed.
4. Put the client ID in `GOOGLE_CLIENT_ID` ([vars]) and run `npx wrangler secret put GOOGLE_CLIENT_SECRET`.
5. Publish the consent screen (move out of "Testing") before launch, or only test users can sign in.

## 2. Microsoft (Entra ID, personal + work/school accounts)
1. Entra admin center → App registrations → New registration, name "DROP Texas".
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (multi-tenant + consumer; the Worker uses the `/common` endpoint).
3. Redirect URI: platform **Web**, `https://droptexas.com/api/auth/microsoft/callback`.
4. Certificates & secrets → New client secret → copy the **Value** → `npx wrangler secret put MICROSOFT_CLIENT_SECRET`. Note its expiry date and rotate before it lapses.
5. Token configuration → Add optional claim → ID token → `email` and **`xms_edov`** (email domain owner verified). Without `xms_edov`, work/school emails are stored as *unverified*; personal Microsoft accounts are treated as verified.
6. API permissions: `openid`, `email`, `profile` (Microsoft Graph, delegated) — default.
7. Put the Application (client) ID in `MICROSOFT_CLIENT_ID` ([vars]).

## 3. Apple (Sign in with Apple)
**Requires a paid Apple Developer Program membership (US$99/year).**
1. Certificates, Identifiers & Profiles → Identifiers → **App ID** with "Sign in with Apple" enabled (primary App ID).
2. Identifiers → **Services ID** (e.g. `com.example.signin`) → enable Sign in with Apple → Configure:
   - Primary App ID: the one above.
   - Domains and subdomains: `droptexas.com`.
   - Return URLs: `https://droptexas.com/api/auth/apple/callback`.
   - Apple may require domain verification (a file served under `/.well-known/` on `droptexas.com`); that file must be served by the site Worker. No DNS change is needed.
3. Keys → New key → enable Sign in with Apple → download the `.p8` (one-time download). Note the **Key ID** and your **Team ID**.
4. Set: `APPLE_CLIENT_ID` = Services ID ([vars]); secrets `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (full PEM contents).
   The Worker generates the ES256 `client_secret` JWT at runtime (5-minute lifetime) — nothing to rotate every 6 months.
5. Apple sends the user's email only reliably on the **first** authorization; the Worker stores it then. "Hide My Email"
   relay addresses (`@privaterelay.appleid.com`) are flagged. To email relay addresses you must register your sending
   domain under Services → Sign in with Apple for Email Communication.

## 4. Shared secret
`OAUTH_COOKIE_KEY`: `openssl rand -base64 32` → `npx wrangler secret put OAUTH_COOKIE_KEY`. Rotating it only invalidates
sign-ins that are in progress (10-minute window).

## 5. Deploy checklist (needs owner approval)
1. `npx wrangler d1 migrations apply DB --remote` (applies `0007_social_auth.sql`: adds tables/columns only, no rebuilds).
2. Set all secrets above, plus the existing `TOTP_ENC_KEY`, `PII_ENC_KEY`, `API_TOKEN`.
3. Replace the placeholder client IDs and `OAUTH_REDIRECT_URIS` in `wrangler.toml`.
4. Confirm the site Worker forwards `/api/*` to this Worker (service binding) and keeps the request host, so the
   redirect URI computed from the request origin matches the allowlist.
5. `SESSION_COOKIE_SAMESITE = "Lax"` (already set): needed because the provider redirect back is a cross-site navigation.

## Local development
Put fake or dev-app values in `worker/.dev.vars` (gitignored). Tests use generated throwaway keys and mock the
provider token/JWKS endpoints; they never contact Google, Apple or Microsoft.
