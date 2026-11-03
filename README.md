# Privacy Opt-Out Dashboard

DROP Texas: a privacy opt-out tracker for Texans covering direct mail, data brokers, credit freezes, Do Not Call, and paid removal services.
Vite + React frontend, Cloudflare Worker + D1/KV backend (the only store). Nothing about the user (records, Texas requests, identifiers) is kept in browser storage; plaintext caches left by older versions are wiped on every load.

## Frontend setup
```bash
npm install
cp .env.example .env   # VITE_API_URL: empty for same-origin /api/* (production); http://localhost:8787 for wrangler dev
npm run dev            # http://localhost:5173
npm run build          # production build to dist/
```
If the API is unreachable, the legacy dashboard shows "offline: read-only, reload to retry" and disables editing, so it can never overwrite server state with defaults. There is no offline cache. `npm run test:storage` checks the cache wipe and the read-only rules.

### Access key (legacy dashboard, dev builds only)
Identifiers ("Your identifiers" on the Texas tab) load from `GET/PUT /api/profile` on the signed-in session, encrypted in D1. `/api/profile` is a same-origin alias of the step-up-gated `/profile`. `loadProfile` calls `/api/me` first and falls back to the legacy KV route `/settings/profile` **only** on a true no-session `401`, and only when a legacy key exists. An MFA-pending, not-stepped-up or otherwise forbidden session (`403`, see the `code` values below) never falls back. It gets its own note on the page instead. If neither source is available, or the server is unreachable, the editor is read-only.

The access key (the Worker's `API_TOKEN` secret) is **not** built into the bundle. On first load the dashboard asks for it and keeps it in this tab's sessionStorage only (gone when the tab closes). Old copies in localStorage are deleted on load.
Use **Forget key** in the header to remove it sooner. If the API ever returns 401, the key is cleared and you are prompted again.
Consider also putting the dashboard behind Cloudflare Access.

### Deploy frontend (Cloudflare Pages)
```bash
VITE_API_URL= npm run build   # empty = same-origin: the app calls /api/* on its own origin (see "Topology")
npx wrangler pages deploy dist --project-name <project> --branch main
```

## Worker (Cloudflare) setup

The API is one Worker (`privacy-dashboard-api`, `worker/`) with a D1 database (binding `DB`) and a KV namespace (binding `RECORDS`, legacy records). It serves two hosts, picked by the request `Host`: the sign-in host (`ACCOUNTS_HOST`, e.g. `accounts.droptexas.com`) and the API on the app origin (`APP_ORIGIN`, e.g. `https://droptexas.com/api/*`). 
**Topology (production).** `workers_dev = false` and `preview_urls = false`, so there is no `*.workers.dev` URL. The Worker's only route is the custom domain `accounts.droptexas.com` (`[[routes]]` in `wrangler.toml`), which serves the sign-in and OAuth pages. The JSON API is same-origin at `https://droptexas.com/api/*`: the landing site forwards `/api/*` to this Worker through its `env.API` service binding. Frontend builds therefore leave `VITE_API_URL` empty (`src/authApi.js` then calls `/api/*` on its own origin). For a different setup, use your own custom domain in your zone (e.g. `privacy-api.example.com`) and set `VITE_API_URL` to it.

The legacy KV dashboard client (`src/storage.js`: `/records`, `/txrequests`, `/settings`) requires a non-empty `VITE_API_URL` pointing at a host that routes *all* paths to this Worker. Production has no such host, so a build with `VITE_API_URL` empty compiles the legacy dashboard out and every route shows the account area / sign-in (`npm run check:no-legacy` verifies this). Builds with `VITE_API_URL` set (e.g. `wrangler dev`, below) keep it at `#/`.

**Development.** `cd worker && npx wrangler dev` serves the Worker at `http://localhost:8787` with local D1/KV (put secrets in `worker/.dev.vars`, and dev origins in `ALLOWED_ORIGIN` there). Point the frontend at it with `VITE_API_URL=http://localhost:8787`.

### 1. Install and create storage
```bash
cd worker
npm install
npx wrangler login                                  # one-time, interactive
npx wrangler kv namespace create RECORDS            # paste the id into [[kv_namespaces]] binding = "RECORDS"
npx wrangler d1 create privacy-dashboard            # paste database_id into [[d1_databases]] binding = "DB"
```
`account_id` is not tracked in `wrangler.toml`; set `CLOUDFLARE_ACCOUNT_ID` in your environment.

### 2. Migrations (`worker/migrations`)
| File | What it does |
|---|---|
| `0001_init.sql` | users, sessions, opt-out requests, confirmations, encrypted PII payloads, audit_log |
| `0002_pii_backup_retention.sql` | backup codes, encrypted profile, PII key versioning, record kinds + retention fields, legacy import ids |
| `0003_in_progress_status.sql` | adds the `in_progress` request status |
| `0004_audit_append_only.sql` | append-only triggers on audit_log, the expiry gate and maintenance_log (idempotent) |
| `0007_social_auth.sql` | user_identities (google/microsoft), oauth_states_used, auth_handoffs, step-up columns, audit ip/user_agent |
| `0008_rate_limits.sql` | strongly consistent fixed-window rate-limit counters (replaces the old KV limiter) |
| `0010_inactive_accounts.sql` | `users.last_active_at` + `users.inactivity_warned_at` for the inactive-account lifecycle (backfills `last_active_at = created_at`) |

There are no 0005/0006 files (numbers were skipped), and 0009 is reserved for the planned email work. Wrangler applies whatever is unapplied, in file order:
```bash
npm run db:migrate:local                                  # = wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote              # production; only with the owner's approval
npx wrangler d1 migrations list DB --remote               # see what is pending
```

### 3. Secrets (`npx wrangler secret put <NAME>`; local values go in `worker/.dev.vars`, gitignored)
| Secret | Purpose | How to generate |
|---|---|---|
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud console, see [docs/oauth-setup.md](docs/oauth-setup.md) |
| `MICROSOFT_CLIENT_SECRET` | Microsoft Entra client secret (the secret **Value**, not its ID) | Entra > Certificates & secrets |
| `OAUTH_COOKIE_KEY` | seals the `__Host-oauth` state cookie and the single-use start token | `openssl rand -base64 32` |
| `TOTP_ENC_KEY` | encrypts TOTP secrets at rest | `openssl rand -base64 32` |
| `PII_ENC_KEY` | encrypts signup/PII payloads (name, DOB, address, email, phone, and a child signup's name, DOB and address) | `openssl rand -base64 32` (separate from TOTP_ENC_KEY) |
| `API_TOKEN` | shared bearer key for the legacy KV `/records`, `/txrequests`, `/settings` API | `openssl rand -base64 32` |
| `ADMIN_BOOTSTRAP_TOKEN` | optional, **off by default**: enables `POST /admin/bootstrap` while it is set | `openssl rand -base64 48` (>=32 chars); delete after use |
| `INTERNAL_PROXY_KEYS` | JSON map `{"<kid>": "<base64 key>"}` of HMAC keys shared with the landing Worker for `X-Internal-Auth` (see Landing proxy contract). Each key >= 32 random bytes and distinct from `PII_ENC_KEY`/`SIGNUP_PII_KEY` and every other secret; shorter or reused keys are dropped at load | `openssl rand -base64 32` per key; kid `[a-z0-9]{1,16}` |
| `PII_ENC_KEY_PREV` | optional, only during PII key rotation (old key, readable with `PII_PREV_KEY_VERSION`) | the previous `PII_ENC_KEY` |

### 4. Vars (`[vars]` in `wrangler.toml`)
- `INACTIVE_WARN_DAYS` (default `700`, about 23 months), `INACTIVE_DELETE_DAYS` (default `730`, 24 months), `INACTIVE_MIN_NOTICE_DAYS` (default `14`) – inactive-account lifecycle, see below.
- `MAIL_FROM` – sender address for account mail. **Stub**: commented out until Email Sending is enabled for the Worker.
- `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID` – public client IDs (placeholders in the repo; set yours at deploy).
- `OAUTH_REDIRECT_URIS` – comma-separated exact allowlist, e.g. `https://accounts.droptexas.com/oauth/google/callback,https://accounts.droptexas.com/oauth/microsoft/callback`. Must match the provider consoles exactly.
- `ALLOWED_ORIGIN` – comma-separated CORS origins, production only (`npm run check:origins` enforces this). Dev origins go in `.dev.vars`.
- `ACCOUNTS_HOST` (sign-in host) and `APP_ORIGIN` (origin that receives the handoff and the `__Host-sid` cookie).
- Sessions (`__Host-sid` is always SameSite=Lax; `SESSION_COOKIE_SAMESITE` is no longer read): `SESSION_IDLE_SECONDS` (43200), `SESSION_ABSOLUTE_SECONDS` (604800), `PREAUTH_SECONDS` (300).
- Retention (days): `PII_RETENTION_DAYS` 30, `PII_HARD_MAX_DAYS` 90, `SESSION_PURGE_DAYS` 7, `FINISHED_RECORD_RETENTION_DAYS` 730, `TX_RECORD_RETENTION_DAYS` 1095, `AUDIT_RETENTION_DAYS` 365 (minimum 365).
- `PII_KEY_VERSION` (and `PII_PREV_KEY_VERSION` during rotation).

### 5. Deploy
```bash
npm test && npm run check:sql && npm run check:origins
npx wrangler deploy
```
The sign-in host `accounts.droptexas.com` is a live Workers Custom Domain, declared in the `[[routes]]` block of `wrangler.toml`; `wrangler deploy` keeps the attachment and manages its DNS record. If you fork this, change that pattern to a host in your zone before deploying.

### Rate limits (`rate_limits`, migration 0008)
- Columns: `key` (sha256 of `scope|id`, where id is IP + account identifier or user id; no raw IPs or emails), `window_start`, `count`, `expires_at` (window end). Primary key `(key, window_start)`, index on `expires_at`.
- Fixed windows (`LIMITS` in `worker/src/ratelimit.js`, e.g. login: 5 failures / 15 min per IP+account, shared by password, TOTP and step-up, and also used for backup-code regen and admin bootstrap). Each counted request is one atomic `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`; D1 is strongly consistent.
- Over the limit: `429` with the usual body and `Retry-After` = seconds until the window ends. Because windows are fixed, up to 2x the limit can land across a window boundary (the old KV TTL restarted on every hit).
- Reserve-then-verify: every limited request first increments the counter atomically and decides from the returned count; above the limit it gets 429 without any password/TOTP/token verification, so at most `max` attempts per window reach a verifier even under parallel bursts. Credential checks (password login, TOTP/backup code, step-up password, admin bootstrap) refund their slot on success, so only failures stay counted. Other scopes (OAuth start/callback, handoff, opt-out writes, backup-code regen) count every attempt.
- Opt-out writes (`POST /optouts`, `PATCH /optouts/:id`, `POST /api/optouts/signup`) share one limit of 30 per hour per user (keyed by user id, not IP). Every attempt counts, including rejected ones: 400 (validation) and 404 (unknown id) responses count toward the 30, and the 31st write in the hour gets 429 with Retry-After. A user can only lock out their own opt-out writes, never login or another account.
- The daily cron deletes ended windows. Old `rl:*` keys in KV are no longer read or written and expire on their own TTL.

### Admin bootstrap (password + TOTP fallback account)
1. `npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN`
2. `POST /admin/bootstrap` with `Authorization: Bearer <ADMIN_BOOTSTRAP_TOKEN>` and `{"email","password"}`. It only succeeds while the users table is empty (atomic `INSERT ... WHERE NOT EXISTS`), then returns 404 forever; it is rate-limited and audited (`user.bootstrap`).
3. Sign in via `POST /auth/login`, enroll TOTP (`/auth/totp/enroll`, `/auth/totp/confirm`).
4. `npx wrangler secret delete ADMIN_BOOTSTRAP_TOKEN`.

### Cron
`crons = ["0 8 * * *"]` (daily 08:00 UTC) runs two separate jobs:
- **purge**: deletes PII past its hard max (`purge_after`) or `PII_RETENTION_DAYS` after confirmation; sessions `SESSION_PURGE_DAYS` after expiry/revocation; used OAuth states (>1 day) and expired handoff codes; finished opt-out records after 730 days and Texas requests after 1095 days (cascades to confirmations and PII). Ended rate-limit windows are deleted too.
- **audit expiry** (`expireAudit`): the only path that deletes audit rows. In one D1 transaction it opens the expiry gate, records the run in `maintenance_log` (job, ran_at, cutoff, rows deleted), deletes rows older than `AUDIT_RETENTION_DAYS` (min 365), and closes the gate.

### Audit log
`audit_log` is append-only: triggers reject every UPDATE and any DELETE outside the expiry gate (and the gate refuses a cutoff newer than 365 days). Rows record user, action, time, `ip` and `user_agent` (in D1 only, never in Workers Logs; unauthenticated `auth.fail` rows store a NULL user_agent). Retention is 12 months, removed only by the expiry job. `maintenance_log` is append-only too.

### Routes
Sign-in host (`ACCOUNTS_HOST`):
- `GET /signin` – sign-in page (Google, Microsoft); `GET /` redirects there.
- `GET /oauth/{google|microsoft}/start` – consumes the start token, redirects to the provider (PKCE + nonce).
- `GET /oauth/{google|microsoft}/callback` – verifies the ID token (JWKS), issues a 60 s single-use handoff code.
- `POST /oauth/{google|microsoft}/bound` – step-up / account-link flow submitted by the browser (`{st}`).

App origin (`/api`, JSON, cookie session `__Host-sid`; state-changing requests need `X-CSRF-Token`):
- `GET /api/auth/{google|microsoft}/start` – sets `__Host-login`, sends the browser to the sign-in host.
- `GET /api/auth/complete?code=` – redeems the handoff code, creates the session.
- `POST /api/auth/{google|microsoft}/stepup`, `POST /api/auth/stepup/password` – re-authentication (valid 10 min). Sensitive routes return `403 {"error":"step_up_required","code":"step_up_required"}` without it.
- Auth errors on session routes: no session (or an expired or revoked one) is `401 {"error":"unauthorized"}`. A `403` body carries a `code` field the client branches on:
  - `mfa_required`: a password session that has not finished TOTP;
  - `step_up_required`: re-authentication needed;
  - `forbidden`: a CSRF or Origin failure. Its body is `{"error":"forbidden"}`, and the client treats a 403 with no `code` the same way.
  
  These come after the session cookie check, so they reveal nothing about other accounts. The sign-in endpoints keep their uniform messages.
- `POST /api/auth/logout`, `GET /api/me`.
- `GET|PUT /api/profile`: same-origin alias of `/profile` below (step-up gated; same body and errors).
- `POST /api/account/identities/{p}/link`, `DELETE /api/account/identities/{p}`.
- `GET|PATCH /api/account/profile`, `GET /api/account/optouts`, `GET /api/account/sessions`, `POST /api/account/sessions/{id}/revoke`, `POST /api/account/export`, `POST /api/account/delete`.
- `POST /api/optouts/signup` – v2 payload (landing PR #12 `shared/signup.ts`, copied byte-identical to `worker/src/shared/signup.ts`): `{firstName, middleName?, lastName, dob, addressLine1, addressLine2?, city, state, zip, email, phone?, texasResident, submitter?, child?, guardianAttestation?}`. `submitter` is `self` (default) or `child`; a child signup needs `child` and `guardianAttestation: true`. `jurisdiction` and `nonTexasFlag` are derived server-side, never client-set. `phone` is optional: a US number, normalized to E.164 (`+1` + 10 digits); missing, empty and null all mean "no phone". Stored encrypted (`pii_payloads`, key `v: 2`). The old v1 body (`{fullName, mailingAddress, ...}`) is now a **400**, so this change must ship together with landing PR #12 (which sends v2); stored v1 records are still readable.

Older session API (same Worker): `/auth/login`, `/auth/totp/*`, `/auth/refresh`, `/auth/logout`, `/auth/backup-codes/regenerate`, `/me`, `/optouts`, `/brokers`, `/profile` (step-up gated), `/admin/bootstrap`.
TOTP on the older routes: only **password** sessions need a finished TOTP for `/profile`, `/optouts` (and `/tx-requests` once #9 lands). Google and Microsoft sessions are accepted, matching the newer `/api/*` routes. Before this change, those routes rejected social sessions with `mfa required`. *This is pending Ben's decision and should be reverted if social sessions must stay blocked there.*
Legacy KV API (`Authorization: Bearer <API_TOKEN>`): `GET|POST /records`, `GET|PUT|DELETE /records/:id`, `/txrequests`, `/settings/profile`.

### Landing proxy contract (droptexas.com Worker -> this API over the `API` service binding)
Only these routes are forwarded; anything else is a 404 at the landing Worker and never reaches the API.

| Method | Path | Signed (`X-Internal-Auth`) |
|---|---|---|
| GET | `/api/me` | yes |
| GET | `/api/auth/{google\|microsoft}/start` | yes (browser redirect; pass `Location` + `Set-Cookie` back) |
| GET | `/api/auth/complete` | yes (pass `Set-Cookie` back) |
| POST | `/api/auth/logout` | yes |
| POST | `/api/auth/stepup/password` | yes |
| POST | `/api/auth/{google\|microsoft}/stepup` | yes |
| GET | `/api/account/profile` | yes |
| PATCH | `/api/account/profile` | yes |
| GET | `/api/account/optouts` | yes |
| GET | `/api/account/sessions` | yes |
| POST | `/api/account/sessions/{16 hex}/revoke` | yes |
| POST | `/api/account/export` | yes |
| POST | `/api/account/delete` | yes |
| POST | `/api/account/identities/{google\|microsoft}/link` | yes |
| DELETE | `/api/account/identities/{google\|microsoft}` | yes |
| POST | `/api/optouts/signup` | yes |

Every route above is signed (GETs included). Request headers the landing Worker sends upstream (build a fresh `Headers`; never copy the client's):
- `Content-Type`, `Accept` (client values, <= 256 chars).
- `Cookie: __Host-sid=<value>` only. The session is still required: the internal header does not authenticate a user.
- `Origin: https://droptexas.com` (the landing Worker's own origin; must be in this API's `ALLOWED_ORIGIN`).
- `CF-Connecting-IP`: the client IP. On a verified signed call the API takes the client IP **only** from this signed value and ignores `request.cf` and every other edge header (`True-Client-IP`, `X-Forwarded-For`, `X-Real-IP`). `request.cf` + `CF-Connecting-IP` are trusted only on unsigned direct traffic. A service-binding call without valid auth never uses the forwarded header; all such calls share one bucket.
- `X-Internal-Auth: v1.<kid>.<ts>.<sig>` **instead of** `X-CSRF-Token` (never forward the client's CSRF token or any client `X-Internal-Auth`).
  - `kid`: `[a-z0-9]{1,16}`. The landing side picks the active kid (`INTERNAL_PROXY_ACTIVE_KID`); the API accepts any kid present in `INTERNAL_PROXY_KEYS`.
  - `ts`: Unix seconds, decimal. Accepted within +/-60 s.
  - `sig`: base64url without padding of HMAC-SHA256(key[kid], canonical), where canonical is
    `"v1\n" + kid + "\n" + METHOD + "\n" + pathname+search + "\n" + ts + "\n" + ip + "\n" + hex(SHA-256(body))`;
    `ip` = the exact `CF-Connecting-IP` header value sent ("" if absent); empty body = SHA-256("") = `e3b0c442...b855`.
  - Body cap 64 KB (same as the landing side), checked before any hashing: larger = `413 {"error":"payload too large"}`.
  - A request that carries `X-Internal-Auth` never falls back to CSRF: bad format, unknown kid, skew, route, method, path, query, body, IP or signature = `403 {"error":"forbidden"}` (constant-time compare; an unknown kid does the same HMAC work against a dummy key, so unknown kid and bad signature give byte-identical 403s, and the 413 never names a kid). Unsigned requests get the normal Origin + `X-CSRF-Token` checks, for direct traffic only.
  - Test vector (published, test-only key, **refused at load** if present in `INTERNAL_PROXY_KEYS`, as are keys under 32 bytes or equal to another secret: `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=`, kid `k1`, ts `1800000000`, ip `203.0.113.9`, `POST /api/account/export?x=1`, body `{"a":1}`): `v1.k1.1800000000.-uCux05nB_YSHLfLwqUuzii9ePuZ2QyIxdgq1kQRCZQ`.
- Rotation: add the new key under a new kid on the API, then switch `INTERNAL_PROXY_ACTIVE_KID` on the landing Worker, wait > 60 s, then remove the old kid from both.
- Because the signature replaces CSRF, the landing Worker owns CSRF for these calls: it must sign only requests whose browser `Origin` (or `Sec-Fetch-Site: same-origin`) is its own origin.
- Browser calls straight to `accounts.droptexas.com` never use this header and keep the normal Origin + `X-CSRF-Token` checks.
- Response: pass status, body, `Content-Type`, `Set-Cookie`, `Location`, `Retry-After`, `Content-Disposition` through; `redirect: "manual"`.
- `Location` values on these routes: a same-origin path (`/start...`, `/account`), or `https://accounts.droptexas.com/oauth/{google|microsoft}/start?st=<token>` (only from `GET /api/auth/{p}/start`). Any other value becomes a 500. The accounts host (not proxied) also redirects to `https://droptexas.com/api/auth/complete?code=...`, `https://droptexas.com/start...`, `https://accounts.google.com/o/oauth2/v2/auth?...` and `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?...`.
- `Set-Cookie` on these routes: only `__Host-sid` (set by `/api/auth/complete` on login; cleared by `/api/auth/logout` and `/api/account/delete`) and `__Host-login` (set by `/api/auth/{p}/start`, `/api/auth/{p}/stepup`, `/api/account/identities/{p}/link`; cleared by `/api/auth/complete`). Both always `Path=/; HttpOnly; Secure; SameSite=Lax`, no `Domain`. `__Host-oauth` exists only on the accounts host.
- Revoke ids are lowercase hex only (`[0-9a-f]{16}`).

**`__Host-sid` is SameSite=Lax by design.** That is safe only because no GET changes account state. GET writes that do exist (audited):
- every session GET: `UPDATE sessions SET last_seen_at` (idle timer), idle/expiry `revoke`, and refresh-token reuse detection (revoke all + `session.reuse_detected` audit). Bookkeeping/defensive only; a forced top-level GET can at most keep an idle session alive.
- `reserve()` rate-limit rows on GET `/api/auth/complete`, `/oauth/{p}/start`, `/oauth/{p}/callback`.
- OAuth flow GETs: `/oauth/{p}/start` (single-use start token `oauth_states_used`), `/oauth/{p}/callback` (`oauth_states_used`, new `users`/`user_identities`, `last_login_at`, handoff row, audit), `/api/auth/complete` (claims the handoff; login creates a session and revokes any prior one; step-up sets `stepped_up_at`; link inserts `user_identities`; audit rows).
- Login CSRF on `/api/auth/complete` is blocked by: `__Host-login` (random, set by the apex start/stepup/link on this browser) whose SHA-256 is sealed into the start token, carried in `__Host-oauth` state, stored as `auth_handoffs.browser_hash`, and compared in constant time at complete (`browser_mismatch` otherwise); plus the OAuth `state` (sealed cookie, constant-time match, single use) and PKCE verifier at the callback; the handoff code is single-use, 60 s. Step-up/link additionally require the same session (`session_hash`).

### Tests and checks
```bash
cd worker
npm test                 # vitest with @cloudflare/vitest-pool-workers (local D1 + KV, migrations applied per run)
npm run check:sql        # fails on string-concatenated SQL (prepared statements only)
npm run check:origins    # fails if ALLOWED_ORIGIN has non-production origins
npm run check            # wrangler deploy --dry-run
```

## Adding a new opt-out service
Edit `src/services.js` and add an entry to `SERVICES`:
```js
{ id: 'lexisnexis', category: 'brokers', name: 'LexisNexis', url: 'https://...', reverifyMonths: 6, notes: '' }
```
`category` must match a `CATEGORIES` id (add a category there if needed). `reverifyMonths` sets the default next re-verification date (submitted date + N months; 12 for credit freezes). No other code changes are needed.

## Notes
- Re-verification dates auto-fill when "Date submitted" is set and stay editable.
- Overdue re-verifications are listed in red at the top and highlighted on cards.

## Texas broker requests tab (TDPSA)

The **Texas broker requests** tab lists every broker in the [Texas SOS data broker registry](https://texas-sos.appianportalsgov.com/data-broker-registry) (bundled export: `src/data/tx-brokers.json`, 445 brokers, exported 2026-10-21). For each broker it builds a Texas Data Privacy and Security Act deletion + opt-out email with **Copy email** and **Open in mail app** (mailto:) buttons. The dashboard never sends email; you send it, then mark it sent.

- Tracking per broker: date sent, 45-day deadline (auto), status (sent, extended +45, completed, no data, not completed (stored as `denied`), appealed +60, AG complaint), response notes. Overdue requests show in red with appeal / AG complaint guidance.
- Requests sync through the Worker at `/txrequests` (KV prefix `txreq:`).
- **Your identifiers** (name, aliases, addresses, phones, emails) live only in the Worker at `/settings/profile` (KV key `settings:profile`), edited from the "Your identifiers" panel. They are not in the site's code.
- **Refreshing the registry:** on the registry site click "Export to Excel", then use "Upload newer registry export" in the tab (XLSX or CSV). An uploaded list is kept in that browser only; to update the bundled list for all devices, replace `src/data/tx-brokers.json` and redeploy.

## Deploying updates

```bash
cd worker && npx wrangler deploy && cd ..
# production build: leave VITE_API_URL empty (same-origin /api/* on droptexas.com via the service binding)
npm run build && npx wrangler pages deploy dist --project-name <project> --branch main
```

Checklist categories now also include People-search sites, Search & apps, and Specialty reports (Innovis, LexisNexis Risk, ChexSystems, NCTUE freezes; 12-month re-verify). Add services in `src/services.js` as before.

## Social sign-in
Provider console setup for Google and Microsoft sign-in: see [docs/oauth-setup.md](docs/oauth-setup.md).

## Inactive accounts (24-month deletion)
- `last_active_at` is set whenever a session is created (password/MFA login, social sign-in, refresh), in the same D1 batch as the session INSERT, and a new sign-in clears any pending warning.
- A daily cron job (`inactiveAccounts`, alongside `purge` and `expireAudit`) sends **one** warning email to accounts inactive for `INACTIVE_WARN_DAYS`. The email text states the actual number of months and the days left, derived from the config.
- At `INACTIVE_DELETE_DAYS` the account is deleted, **but only if** a warning was recorded at least `INACTIVE_MIN_NOTICE_DAYS` earlier. Deleting the `users` row cascades to sessions, identities, handoffs, backup codes, profile, opt-out requests, confirmations and encrypted PII payloads. `audit_log` rows keep only the user id and expire on their own schedule.
- **Mailer stub**: the `[[send_email]] MAILER` binding and `MAIL_FROM` are commented out in `wrangler.toml`. Without them nobody is warned, so nobody is deleted.
- **Backlog**: each run warns at most 100 accounts (`LIMIT 100`). A larger backlog drains over the following daily runs, and each account still gets the full notice period after its own warning, so a backlog delays deletions and never shortens notice. A failed send is skipped (no address logged) and retried next run.
- **Deadline in the email**: deletion happens at the later of last activity + `INACTIVE_DELETE_DAYS` and warning + `INACTIVE_MIN_NOTICE_DAYS`. The email states that real per-account deadline (days left and a UTC date): about 29-30 days for an on-time warning, 14 days for a late one. Signing in at any point before deletion resets `last_active_at` and clears the warning, so the next run cannot delete the account.
- Social-only accounts store a placeholder `users.email` (`<id>@users.invalid`); the job skips those addresses. Warning them needs the real (encrypted) identity email, which is part of the email work.
- The public privacy policy should state this 24-month inactivity deletion; that page lives in the landing site repo.

## Logging (Workers Logs)
- `worker/wrangler.toml` enables Workers Logs: `[observability] enabled = true`, `head_sampling_rate = 1` (every request is logged).
- **Only `worker/src/log.js` may log.** Everything else calls `log(event, fields)` / `logError(event, err, fields)`. `npm --prefix worker run check:logs` fails if `console.*` appears anywhere else in `worker/src`.
- Fields are allowlisted (`method`, `route`, `status`, `ms`, `surface`, `counts`, `deleted`, `warned`, `job`, `error`). Request bodies, headers, cookies, tokens, query strings, IPs, user agents and PII are never logged. Routes are normalized (`/optouts/:id`) so ids and user input never appear. Errors log only the error name (no message or stack). Free text is scrubbed of emails, long tokens and phone numbers as a second line of defense.
- One `request` line per response from every surface: `accounts` (sign-in host), `legacy` (KV routes), `app`, `api`, including 403 origin rejects, OPTIONS preflights and 500s. Scheduled jobs log counts only (`purge`, `audit_expiry`, `inactive_accounts`). One `scheduled` handler (`runScheduled` in `worker/src/index.js`) runs all three independently; a failed job logs `scheduled_job` with its name and error class, and the others still run.
