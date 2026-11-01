# Social sign-in setup (Google, Microsoft)

Only Google and Microsoft are supported (Apple sign-in was removed), plus the email + password + TOTP fallback.

DROP Texas uses same-origin sign-in: the site forwards `/api/*` to the `privacy-dashboard-api` Worker, so every
provider redirects back to `https://droptexas.com/api/auth/{provider}/callback`. Register these exact URIs
(production `OAUTH_REDIRECT_URIS` in `wrangler.toml` lists exactly these; local dev URIs go in `worker/.dev.vars`):

| Provider  | Redirect URI                                           | Method |
|-----------|--------------------------------------------------------|--------|
| Google    | `https://droptexas.com/api/auth/google/callback`       | GET    |
| Microsoft | `https://droptexas.com/api/auth/microsoft/callback`    | GET    |

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
4. Confirm the site Worker forwards `/api/*` to this Worker (service binding) and keeps the request host, so the
   redirect URI computed from the request origin matches the allowlist.
5. `SESSION_COOKIE_SAMESITE = "Lax"` (already set): needed because the provider redirect back is a cross-site navigation.

## Local development
Copy `worker/.dev.vars.example` to `worker/.dev.vars` (gitignored) and put fake or dev-app values there; dev origins (localhost, pages.dev) live only there. `npm run check:origins` fails if production `ALLOWED_ORIGIN` contains anything but `https://droptexas.com,https://www.droptexas.com`. Tests use generated throwaway keys and mock the
provider token/JWKS endpoints; they never contact Google or Microsoft.

## Step-up (re-authentication)
Sensitive actions (export, delete, session revoke, identifier reads/writes, linking, and the legacy `/profile` and
`/optouts/:id/pii` routes) need a step-up within the last 10 minutes. Google/Microsoft step-up and link requests send
`prompt=login` and `max_age=0`, and the callback refuses the result unless the ID token has a numeric `auth_time` no
older than 600 seconds. Password + TOTP is the other step-up route.
