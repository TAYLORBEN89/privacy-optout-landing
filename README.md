# Privacy Opt-Out Dashboard

DROP Texas: a privacy opt-out tracker for Texans covering direct mail, data brokers, credit freezes, Do Not Call, and paid removal services.
Vite + React frontend, Cloudflare Worker + D1/KV backend (source of truth), localStorage as an offline cache.

## Frontend setup
```bash
npm install
cp .env.example .env   # VITE_API_URL: empty for same-origin /api/* (production); http://localhost:8787 for wrangler dev
npm run dev            # http://localhost:5173
npm run build          # production build to dist/
```
If the API is unreachable, the app falls back to cached data in localStorage and shows "offline (cached)".

### Access key
The access key (the Worker's `API_TOKEN` secret) is **not** built into the bundle. On first load the dashboard asks for it and stores it in this browser's localStorage.
Use **Forget key** in the header to remove it. If the API ever returns 401, the key is cleared and you are prompted again.
Consider also putting the dashboard behind Cloudflare Access.

### Deploy frontend (Cloudflare Pages)
```bash
VITE_API_URL= npm run build   # empty = same-origin: the app calls /api/* on its own origin (see "Topology")
npx wrangler pages deploy dist --project-name <project> --branch main
```

## Worker (Cloudflare) setup

The API is one Worker (`privacy-dashboard-api`, `worker/`) with a D1 database (binding `DB`) and a KV namespace (binding `RECORDS`, legacy records). It serves two hosts, picked by the request `Host`: the sign-in host (`ACCOUNTS_HOST`, e.g. `accounts.droptexas.com`) and the API on the app origin (`APP_ORIGIN`, e.g. `https://droptexas.com/api/*`). 
**Topology (production).** `workers_dev = false` and `preview_urls = false`, so there is no `*.workers.dev` URL. The Worker's only route is the custom domain `accounts.droptexas.com` (`[[routes]]` in `wrangler.toml`), which serves the sign-in and OAuth pages. The JSON API is same-origin at `https://droptexas.com/api/*`: the landing site forwards `/api/*` to this Worker through its `env.API` service binding. Frontend builds therefore leave `VITE_API_URL` empty (`src/authApi.js` then calls `/api/*` on its own origin). For a different setup, use your own custom domain in your zone (e.g. `privacy-api.example.com`) and set `VITE_API_URL` to it.

The legacy KV dashboard client (`src/storage.js`: `/records`, `/txrequests`, `/settings`) requires a non-empty `VITE_API_URL` pointing at a host that routes *all* paths to this Worker. Production has no such host, so use it only against `wrangler dev` (below) or a custom domain you attach for it.

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

There are no 0005/0006 files (numbers were skipped). Wrangler applies whatever is unapplied, in file order:
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
| `PII_ENC_KEY` | encrypts signup/PII payloads (name, address, email, phone) | `openssl rand -base64 32` (separate from TOTP_ENC_KEY) |
| `API_TOKEN` | shared bearer key for the legacy KV `/records`, `/txrequests`, `/settings` API | `openssl rand -base64 32` |
| `ADMIN_BOOTSTRAP_TOKEN` | optional, **off by default**: enables `POST /admin/bootstrap` while it is set | `openssl rand -base64 48` (>=32 chars); delete after use |
| `PII_ENC_KEY_PREV` | optional, only during PII key rotation (old key, readable with `PII_PREV_KEY_VERSION`) | the previous `PII_ENC_KEY` |

### 4. Vars (`[vars]` in `wrangler.toml`)
- `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID` – public client IDs (placeholders in the repo; set yours at deploy).
- `OAUTH_REDIRECT_URIS` – comma-separated exact allowlist, e.g. `https://accounts.droptexas.com/oauth/google/callback,https://accounts.droptexas.com/oauth/microsoft/callback`. Must match the provider consoles exactly.
- `ALLOWED_ORIGIN` – comma-separated CORS origins, production only (`npm run check:origins` enforces this). Dev origins go in `.dev.vars`.
- `ACCOUNTS_HOST` (sign-in host) and `APP_ORIGIN` (origin that receives the handoff and the `__Host-sid` cookie).
- Sessions: `SESSION_COOKIE_SAMESITE` (Lax), `SESSION_IDLE_SECONDS` (43200), `SESSION_ABSOLUTE_SECONDS` (604800), `PREAUTH_SECONDS` (300).
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
- `POST /api/auth/{google|microsoft}/stepup`, `POST /api/auth/stepup/password` – re-authentication (valid 10 min). Sensitive routes return `403 {"error":"step_up_required"}` without it.
- `POST /api/auth/logout`, `GET /api/me`.
- `POST /api/account/identities/{p}/link`, `DELETE /api/account/identities/{p}`.
- `GET|PATCH /api/account/profile`, `GET /api/account/optouts`, `GET /api/account/sessions`, `POST /api/account/sessions/{id}/revoke`, `POST /api/account/export`, `POST /api/account/delete`.
- `POST /api/optouts/signup` – `{fullName, mailingAddress, email, texasResident, phone?}`. `phone` is optional: a US number, normalized to E.164 (`+1` + 10 digits); missing, empty and null all mean "no phone". Stored encrypted with the rest of the signup PII.

Older session API (same Worker): `/auth/login`, `/auth/totp/*`, `/auth/refresh`, `/auth/logout`, `/auth/backup-codes/regenerate`, `/me`, `/optouts`, `/brokers`, `/profile` (step-up gated), `/admin/bootstrap`.
Legacy KV API (`Authorization: Bearer <API_TOKEN>`): `GET|POST /records`, `GET|PUT|DELETE /records/:id`, `/txrequests`, `/settings/profile`.

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
