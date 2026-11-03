# Privacy opt-out landing

v1 landing page for DROP Texas, a private, free privacy opt-out service. The page is a Vite + React app. Cloudflare Workers serves the built files as static assets and handles `POST /api/signup`.

DROP Texas is an independent, free service run by a private enterprise. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.

This version checks the form and returns success. It does not save the submission. A later backend owns D1/KV. See `worker/storage.ts`.

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

`npm run worker:dev` is the same Wrangler command. There is no persistence yet, and this repo has no secrets to configure.

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

`VITE_ACCOUNTS_LIVE` defaults to off. Until it is `true`, the site does not present accounts as available. The header shows neither Sign in nor the account icon. `/account` and the SPA `/signin` page show the same Coming soon sentence as the privacy page, and Start stays on `/start` even when `VITE_AUTH_GATE` is on. Set `VITE_ACCOUNTS_LIVE=true` to show the header control, the account page, and the gate redirect to the accounts host. A direct request to `/signin` on the Worker still redirects to that host; the pages themselves do not link there while the flag is unset.

Sign-in is hosted at `accounts.droptexas.com`, like a separate accounts site. `ACCOUNTS_ORIGIN` defaults to `https://accounts.droptexas.com` and can be overridden with `VITE_ACCOUNTS_ORIGIN`. The header Sign in link, the sign-in gate, and any other sign-in control leave this site with a full page load to `${ACCOUNTS_ORIGIN}/signin?return_to=/start` or `return_to=/account`. `return_to` must be a same-site path that starts with `/` and not `//`. A local visit to `/signin` redirects there and keeps a valid `return_to`.

After sign-in, the browser returns to `https://droptexas.com/api/auth/complete?code=...`. That request is under `/api/*` (`run_worker_first`), so the Worker forwards it through the API binding and does not serve the SPA shell.

`/api/me`, `/api/account/*`, and `/api/optouts/signup` stay on this origin. `POST /api/signup` is still handled in this Worker. Other `/api` paths forward to the `API` service binding when it is uncommented in `wrangler.jsonc`. Until then they return JSON 404. Logout stays `POST /api/auth/logout` on this origin.

## Tests

```sh
npm test
```

`npm run typecheck` runs the TypeScript check that `npm run build` also runs.

## What the form does

The form collects your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address. A checked box and an unchecked box both use jurisdiction `TDPSA`. An unchecked box also sets `nonTexasFlag` to true. Nothing is stored in this version.

`STORAGE_LIVE` in `worker/storage.ts` is false. The page says the preview does not store submissions. Set that constant to true only when D1 is actually saving records. The replacement sentence is `STORAGE_LIVE_NOTE`.

The browser and the Worker both use `shared/signup.ts`. Bad input returns per-field errors. The Worker does not log field values.

### Signup payload

`POST /api/signup` accepts and revalidates this JSON shape. Empty optional fields are `null`. `jurisdiction` and `nonTexasFlag` are derived from `texasResident` and are included in the posted body. The Worker still validates and discards the value. Nothing is stored.

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

These routes are on this origin and are forwarded to the `API` service binding when that binding is uncommented in `wrangler.jsonc`. Until then they return JSON 404. The account page calls them only when `VITE_ACCOUNTS_LIVE=true`. Mutations send `X-CSRF-Token` from `GET /api/me`. A `403` body `{ "error": "step_up_required" }` opens step-up. No other 403 does.

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
