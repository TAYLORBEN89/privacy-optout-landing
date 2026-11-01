# Privacy opt-out landing

v1 landing page for DROP Texas, a private, free privacy opt-out service. The page is a Vite + React app. Cloudflare Workers serves the built files as static assets and handles `POST /api/signup`.

DROP Texas is an independent, free service run by Benjamin Taylor, an individual in Texas. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.

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

`VITE_ACCOUNTS_LIVE` defaults to off. Until it is `true`, the header does not show Sign in or the account icon. The gate redirect still sends a signed-out visitor to the accounts host when the gate is on.

Sign-in is hosted at `accounts.droptexas.com`, like a separate accounts site. `ACCOUNTS_ORIGIN` defaults to `https://accounts.droptexas.com` and can be overridden with `VITE_ACCOUNTS_ORIGIN`. The header Sign in link, the sign-in gate, and any other sign-in control leave this site with a full page load to `${ACCOUNTS_ORIGIN}/signin?return_to=/start` or `return_to=/account`. `return_to` must be a same-site path that starts with `/` and not `//`. A local visit to `/signin` redirects there and keeps a valid `return_to`.

After sign-in, the browser returns to `https://droptexas.com/api/auth/complete?code=...`. That request is under `/api/*` (`run_worker_first`), so the Worker forwards it through the API binding and does not serve the SPA shell.

`/api/me`, `/api/account/*`, and `/api/optouts/signup` stay on this origin. `POST /api/signup` is still handled in this Worker. Other `/api` paths forward to the `API` service binding when it is uncommented in `wrangler.jsonc`. Until then they return JSON 404. Logout stays `POST /api/auth/logout` on this origin.

## Tests

```sh
npm test
```

`npm run typecheck` runs the TypeScript check that `npm run build` also runs.

## What the form does

The form collects your name, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. A checked box and an unchecked box both use jurisdiction `TDPSA`. An unchecked box also sets `nonTexasFlag` to true. Nothing is stored in this version.

`STORAGE_LIVE` in `worker/storage.ts` is false. The page says the preview does not store submissions. Set that constant to true only when D1 is actually saving records. The replacement sentence is `STORAGE_LIVE_NOTE`.

The browser and the Worker both use `shared/signup.ts`. Bad input returns per-field errors. The Worker does not log field values.

`src/analytics.ts` has a no-op `track()` for `form_started`, `field_error`, and `submitted`. Events carry a field name and error code, never the value typed into the form. Vite dev logs only the event name.
