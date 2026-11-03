# Privacy opt-out landing

v1 landing page for DROP Texas, a private, free privacy opt-out service. The page is a Vite + React app. Cloudflare Workers serves the built files as static assets and handles `POST /api/signup`.

DROP Texas is an independent, free service run by a private enterprise. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.

Validated signups are stored in the D1 database `drop-texas-signups`. See `worker/storage.ts`. After a signup is saved, the Worker records one pending opt-out row for each named broker. See `worker/optouts.ts`. Those pages need an account, a captcha, a listing URL, or an interactive form, so this Worker does not POST personal information to them. Every row stays `pending`. This Worker never writes `confirmed` or `no_record`.

## Run locally

Install dependencies:

```sh
npm install
```

Frontend with hot reload (http://localhost:5173). API calls are proxied to the Worker on port 8787, so start Wrangler too if you submit the form from this server:

```sh
npm run dev
```

Worker and the built page together (http://127.0.0.1:8787). Build first so `dist/` exists:

```sh
npm run build
npx wrangler dev
```

`npm run worker:dev` is the same Wrangler command. Local D1 uses `.wrangler/state`. Apply schema with `npx wrangler d1 migrations apply drop-texas-signups --local`. It needs one Worker secret (see **Signup PII encryption**) and two migrations, 0004 and 0005 (see **Before deploy**).

## Signup PII encryption

Signup PII is encrypted in the Worker with AES-256-GCM before it is written to D1. That covers name, date of birth, street address, city, ZIP, email, phone and child details. An HMAC-SHA-256 blind index of the lowercased email (`email_hmac`) allows equality lookups, such as deletion requests, without storing the email. Both keys are derived with HKDF-SHA-256 from one secret. `state`, `jurisdiction` and the flags stay in plaintext.

- **Secret name:** `SIGNUP_PII_KEY`. Never commit it, put it in `wrangler.jsonc`, or log it.
- **Format:** exactly 32 random bytes, encoded as standard base64 (RFC 4648 `+ /` alphabet, with `=` padding). That's 44 characters ending in one `=`. Surrounding whitespace and a trailing newline are ignored. Hex, base64url and unpadded base64 are rejected.
- **Generate:** `openssl rand -base64 32` produces exactly this format and works as-is.
- **Production:** `npx wrangler secret put SIGNUP_PII_KEY`. Wrangler prompts for the value. Don't pass it on the command line.
- **Local dev:** put `SIGNUP_PII_KEY=<base64>` in `.dev.vars`, which is gitignored. Use a different key from production.
- **Wrong or missing key:** `/api/signup` fails closed. It stores nothing, returns a generic 500, and logs the error code `signup_key_missing` or `signup_key_invalid` (never the value).
- **Losing the key** makes stored PII unreadable, so keep a copy in the password manager. Rotating it needs a re-encryption job, which is not built yet.

## Signup rate limit

`POST /api/signup` is rate limited in D1, in the `rate_limits` table from migration 0005. No new binding is used.

- **Limits:** 5 per 10 minutes and 20 per day, per hashed client IP. The key is sha256 of the scope and `CF-Connecting-IP`; raw IPs are never stored.
- **What counts:** only submissions that pass validation. A request that's already over the limit doesn't increment either counter, because the UPSERT is conditional and earlier slots are refunded. Retrying doesn't use up the daily cap.
- **Over the limit:** a uniform `429` with `{"form":{"code":"rate_limited","message":"Too many requests. Try again later."}}`, a `Retry-After` header (seconds until the window resets) and `cache-control: no-store`. No counts, scopes or IPs are returned.
- **Limiter unavailable:** if the D1 write fails, it fails closed with a generic `503`. The signup would need the same database anyway.
- **Missing `CF-Connecting-IP`:** Cloudflare always sets it in production, so a request without it gets a generic `400` rather than sharing one bucket. On `localhost` and `127.0.0.1`, a dev-only key is used instead.
- **Cleanup:** expired rows are deleted on about 2% of allowed requests. It's best-effort: a failure is logged as `rate_limit_cleanup_failed`, with no PII, and the signup continues.

### Before deploy (needs Ben's approval)

1. Set `SIGNUP_PII_KEY` as described above.
2. Apply migration `0004_encrypt_sensitive_signup_fields.sql`, which adds `pii_enc`, `email_hmac` and an index. Run `npx wrangler d1 migrations apply drop-texas-signups --local` first, then `--remote`.
3. Rows written before 0004 still hold plaintext. Check with `SELECT COUNT(*) FROM signups WHERE pii_enc IS NULL;`. Then do one of these:
   - **Purge:** delete those rows and their `optout_requests` if they are test data. This is the preferred option before launch.
   - **Backfill:** run a one-off script that writes `pii_enc` and `email_hmac` with the same key, then blanks the plaintext columns.
4. Confirm the count above returns 0 before going live.
5. A later migration can drop the legacy plaintext columns.
6. **Required:** apply migration `0005_rate_limits.sql`, which creates `rate_limits`. Run `npx wrangler d1 migrations apply drop-texas-signups --local` first, then `--remote`. Without it, every signup returns 503.

## Landing /api proxy contract

The Worker forwards only allowlisted `/api` routes to the API Worker (`env.API` service binding). **The binding stays off in `wrangler.jsonc`** until the API Worker ships with the same contract; with it off every proxied route returns 404.

**Allowlist** (anything else is 404, never forwarded):

| Method | Path |
| --- | --- |
| GET | `/api/me` |
| GET | `/api/auth/{google\|microsoft}/start` |
| GET | `/api/auth/complete` |
| POST | `/api/auth/logout` |
| POST | `/api/auth/stepup/password` |
| POST | `/api/auth/{google\|microsoft}/stepup` |
| GET, PATCH | `/api/account/profile` |
| GET | `/api/account/optouts` |
| GET | `/api/account/sessions` |
| POST | `/api/account/sessions/{16 lowercase hex}/revoke` |
| POST | `/api/account/export` |
| POST | `/api/account/delete` |
| POST | `/api/account/identities/{google\|microsoft}/link` |
| DELETE | `/api/account/identities/{google\|microsoft}` |
| POST | `/api/optouts/signup` |

**Landing CSRF (unsafe methods):** `Origin` must exactly equal the Worker's own origin; if `Origin` is absent, `Sec-Fetch-Site: same-origin` is required. Otherwise a uniform 403. Request bodies are capped at 64 KB (413).

**Upstream request headers are built fresh:** `Content-Type` and `Accept` (max 256 chars each, else 400), `Cookie` containing only a validated `__Host-sid`, `Origin: https://droptexas.com`, `CF-Connecting-IP` copied from the incoming request, and `X-Internal-Auth`. The client's `X-CSRF-Token`, `X-Internal-Auth`, `Authorization`, `Cookie` and `Origin` are never forwarded.

**X-Internal-Auth** (every proxied request, GETs included):

```
X-Internal-Auth: v1.<kid>.<ts>.<sig>
kid = [a-z0-9]{1,16}; ts = unix seconds
canonical = "v1\n" + kid + "\n" + METHOD + "\n" + pathname+search + "\n" + ts + "\n" + ip + "\n" + hex(sha256(body))
ip  = exact CF-Connecting-IP forwarded, or "" if absent
sig = base64url (no padding) of HMAC-SHA256(key[kid], canonical)
```

Test vector (in `tests/apiProxy.test.ts`; the key is a test-only constant, bytes 0x00..0x1f): kid `k1`, ts `1800000000`, ip `203.0.113.9`, `POST /api/account/export?x=1`, body `{"a":1}` → `v1.k1.1800000000.-uCux05nB_YSHLfLwqUuzii9ePuZ2QyIxdgq1kQRCZQ`.

**Responses:** fetched with `redirect: 'manual'`; only status, body, `Content-Type`, `Set-Cookie`, `Location`, `Retry-After` and `Content-Disposition` pass through. `Set-Cookie` is limited to the names in `ALLOWED_RESPONSE_COOKIES` (`__Host-sid`, `__Host-login`), and any such cookie without `Path=/`, `Secure` and `HttpOnly`, or with a `Domain`, is dropped. `Location` is kept only for a same-origin path or an absolute URL whose origin+pathname is exactly `https://accounts.droptexas.com/oauth/google/start` or `https://accounts.droptexas.com/oauth/microsoft/start` (query allowed); anything else is dropped.

**Upstream request:** always a freshly built `new Request(url, { method, headers, body, redirect: "manual" })`, never derived from the incoming `Request`, so it carries no `cf` (the API treats `request.cf` as edge traffic).

### INTERNAL_PROXY_KEYS

- **Secret** `INTERNAL_PROXY_KEYS`: JSON object `{"<kid>": "<standard base64 key>"}`; kid matches `[a-z0-9]{1,16}`, each key decodes to at least 32 bytes.
- **Plain var** `INTERNAL_PROXY_ACTIVE_KID`: the kid used to sign.
- Bad JSON, a missing active kid, a bad kid, a short key, or a key equal to `SIGNUP_PII_KEY` fails closed: proxied routes return a generic 503 and only the error code is logged (never key material).
- The API Worker must hold the **same** map. The key must differ from `SIGNUP_PII_KEY`.

Generate and store (never commit or paste a value):

```sh
openssl rand -base64 32        # one key; put it in the JSON under a new kid
npx wrangler secret put INTERNAL_PROXY_KEYS   # paste {"<kid>":"<key>"} at the prompt
```

Rotation: (1) add the new kid to the map in both Workers, (2) switch `INTERNAL_PROXY_ACTIVE_KID` to the new kid, (3) once traffic is on it, remove the old kid from both maps.

## Deploy

Do not deploy until you mean to publish. `npx wrangler deploy` attaches the Worker to the hostnames in `wrangler.jsonc` and creates DNS for them.

The config uses custom domains, not a path route:

- `droptexas.com`
- `www.droptexas.com`

`custom_domain: true` makes the Worker the origin. On deploy, Cloudflare creates the DNS records and proxies them (orange cloud). A custom domain matches one hostname, so both names are listed. Certificates are issued for you.

Requests to `www.droptexas.com` are redirected by this Worker to `https://droptexas.com` with the same path and query. GET and HEAD use 301. Other methods use 308 so a POST body is preserved. Localhost and every other host stay as they are.

Before you deploy:

1. Use a Cloudflare account that will own the site.
2. Add `droptexas.com` as a zone and point the registrar nameservers at Cloudflare. Wait until the zone is active.
3. Confirm the same account will run the deploy. Custom domains can only be created on a zone that account owns.
4. Remove any existing CNAME on `droptexas.com` or `www` first. Cloudflare cannot create a custom domain on a hostname that already has a CNAME.
5. Authenticate Wrangler with `npx wrangler login`, or set `CLOUDFLARE_API_TOKEN` in the environment. The token needs permission to deploy Workers and edit DNS on that zone. Do not commit the token.

Then, from this repo:

```sh
npm install
npm test
npm run build
npx wrangler deploy
```

After deploy, both hostnames should resolve through Cloudflare to this Worker. This README does not run that command.

`wrangler.jsonc` uses compatibility date `2026-10-30`, the newest date this repo's Wrangler binary accepts. Bump it when you upgrade Wrangler.

## Draft auth and pages

`VITE_AUTH_GATE` defaults to on. Set `VITE_AUTH_GATE=false` at build time to show `/start` and `/account` without a session.

`VITE_ACCOUNTS_LIVE` is read from the environment for each build and is off unless set to `true`. Production stays off until approved. When on, the live site shows Sign in, the account page, and the gate redirect to the accounts host. A direct request to `/signin` on the Worker redirects to that host.

Sign-in is hosted at `accounts.droptexas.com`, like a separate accounts site. `ACCOUNTS_ORIGIN` defaults to `https://accounts.droptexas.com` and can be overridden with `VITE_ACCOUNTS_ORIGIN`. The header Sign in link, the sign-in gate, and any other sign-in control leave this site with a full page load to `${ACCOUNTS_ORIGIN}/signin?return_to=/start` or `return_to=/account`. `return_to` must be a same-site path that starts with `/` and not `//`. A local visit to `/signin` redirects there and keeps a valid `return_to`.

After sign-in, the browser returns to `https://droptexas.com/api/auth/complete?code=...`. That request is under `/api/*` (`run_worker_first`), so the Worker forwards it through the API binding and does not serve the SPA shell.

`/api/me`, `/api/account/*`, and `/api/optouts/signup` stay on this origin. `POST /api/signup` is still handled in this Worker. Other `/api` paths forward to the `API` service binding when it is uncommented in `wrangler.jsonc`. Until then they return JSON 404. Logout stays `POST /api/auth/logout` on this origin.

## Tests

```sh
npm test
```

`npm run typecheck` runs the TypeScript check that `npm run build` also runs.

## What the form does

The form collects your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address. A checked box and an unchecked box both use jurisdiction `TDPSA`. An unchecked box also sets `nonTexasFlag` to true. Accepted submissions are written to D1, then one pending broker row is recorded for each name in the broker list. When the request has a session cookie and `X-CSRF-Token`, the Worker also posts the signup to `POST /api/optouts/signup` so it belongs to that account, and stores the user id on the signup row. A failure of that account post does not undo the saved signup, and the form still returns success. The Worker does not log field values.

`STORAGE_LIVE` in `worker/storage.ts` is true while `saveSignup()` writes those rows. The page then uses `STORAGE_LIVE_NOTE`. Set the constant to false only if writes are turned off.

The browser and the Worker both use `shared/signup.ts`. Bad input returns per-field errors. The Worker does not log field values.

### Signup payload

`POST /api/signup` accepts and revalidates this JSON shape. Empty optional fields are `null`. `jurisdiction` and `nonTexasFlag` are derived from `texasResident` and are included in the posted body. The Worker validates the body and stores the derived values with the signup. The success response does not mean a broker confirmed a deletion. The page then lists each named broker as Pending, with the reason and a link to that company's page.

```json
{
  "firstName": "Ada",
  "middleName": null,
  "lastName": "Lovelace",
  "dob": "1815-12-10",
  "addressLine1": "123 Main St",
  "addressLine2": null,
  "city": "Austin",
  "state": "TX",
  "zip": "78701",
  "email": "ada@example.com",
  "phone": null,
  "texasResident": true,
  "submitter": "self",
  "child": null,
  "guardianAttestation": false,
  "jurisdiction": "TDPSA",
  "nonTexasFlag": false
}
```

`state` is a USPS abbreviation for a state or the District of Columbia. `zip` matches `^\d{5}(-\d{4})?$`. `dob` is `YYYY-MM-DD`, required, a real calendar date, not in the future, and not more than 120 years ago. `phone`, when present, is E.164 (`+1` and 10 digits). The old keys `fullName` and `mailingAddress` are not accepted.

`src/analytics.ts` has a no-op `track()` for `form_started`, `field_error`, and `submitted`. Events carry a field name and error code, never the value typed into the form. A phone number, including a rejected one, is not included. Vite dev logs only the event name.

## Topic routes

These are real pages. The homepage does not use hash links for them.

| Path | Page |
| --- | --- |
| `/overview` | Overview |
| `/how-it-works` | How it works |
| `/personal-information` | Personal information |
| `/data-brokers` | Data brokers |
| `/unique-identifiers` | Unique identifiers |
| `/tdpsa` | TDPSA |
| `/children` | Children |
| `/help` | Help |
| `/share` | Share |
| `/brokers` | Broker list |
| `/privacy` | Privacy |
| `/security` | Security |
| `/about` | About |

`/start` is the opt-out form. `/account` is the account page only when `VITE_ACCOUNTS_LIVE=true`. Otherwise it shows Coming soon.

## Account API

These routes are on this origin and are forwarded to the `API` service binding for `privacy-dashboard-api`. Mutations send `X-CSRF-Token` from `GET /api/me`. A `403` body `{ "error": "step_up_required" }` opens step-up. No other 403 does.

The current signup payload keys, also posted to `POST /api/signup`, are `firstName`, `middleName`, `lastName`, `dob`, `addressLine1`, `addressLine2`, `city`, `state`, `zip`, `email`, `phone`, `texasResident`, `submitter`, `child`, `guardianAttestation`, `jurisdiction`, and `nonTexasFlag`. The shape is in the signup payload section above. `child` is `null` for a self request, or an object with `firstName`, `middleName`, `lastName`, `dob`, `sameAddress`, and, when `sameAddress` is false, `addressLine1`, `addressLine2`, `city`, `state`, and `zip`.

`GET /api/me` returns `200` with `user` (`id`, `display_name`, `has_password`, `totp_enabled`, `created_at`), `providers` (each `provider`, and optional `verified`, `private_relay`, `email_verified`, `is_private_relay`), `auth_method`, `mfa`, `limited`, `stepped_up_until`, and `csrf_token`.

`GET /api/account/profile` returns `{ "display_name": string | null, "identifiers_locked": boolean }`. `PATCH /api/account/profile` sends `{ "display_name": string }` and returns `{ "ok": true }`.

`GET /api/account/optouts` returns `{ "optouts": OptOutRecord[] }`. Each record has `id`, `kind`, `status`, `sub_status`, `broker_id`, `service_id`, `created_at`, `updated_at`, `submitted_at`, `confirmed_at`, `finished_at`, and `deadline`. Times are unix seconds. `status` of `denied` is shown as Not completed. `sub_status` of `no_record` is shown as No record found.

`GET /api/account/sessions` returns `{ "sessions": AccountSession[] }`. Each session has `id`, `auth_method`, `created_at`, `last_seen_at`, `expires_at`, and `current`.

`POST /api/account/sessions/{id}/revoke` has an empty body and returns `{ "ok": true }`. The session row is removed. A step-up 403 leaves the row and opens confirmation.

`POST /api/account/export` has an empty body and returns the export JSON, which the browser downloads. This is not a claim that deletion was verified.

`POST /api/account/delete` has an empty body and returns `{ "ok": true }`. The browser then goes to `/`. Cancel sends no request.

`POST /api/auth/google/stepup` and `POST /api/auth/microsoft/stepup` send `{ "return_to": "/account" }` and return `{ "action": "https://...", "method": "POST", "fields": { "st": "..." } }`. The browser posts that form. Apple is not a provider. `POST /api/auth/stepup/password` sends `{ "password": string, "code": string }` and returns `{ "ok": true }`.

`POST /api/account/identities/google/link` and `POST /api/account/identities/microsoft/link` use the same handoff shape. `DELETE /api/account/identities/{google|microsoft}` returns `{ "ok": true }`.
