# Privacy opt-out landing

v1 landing page for Drop Texas, a private, free privacy opt-out service. The page is a Vite + React app. Cloudflare Workers serves the built files as static assets and handles `POST /api/signup`.

Drop Texas is a private, free service. It is not affiliated with or endorsed by the State of California, CalPrivacy, or any government agency.

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

## Tests

```sh
npm test
```

`npm run typecheck` runs the TypeScript check that `npm run build` also runs.

## What the form does

The form collects full name, mailing address, email, and a Texas residency checkbox. A checked box and an unchecked box both use jurisdiction `TDPSA`. An unchecked box also sets `nonTexasFlag` to true. Nothing is stored in this version.

`STORAGE_LIVE` in `worker/storage.ts` is false. The page says the preview does not store submissions. Set that constant to true only when D1 is actually saving records. The replacement sentence is `STORAGE_LIVE_NOTE`.

The browser and the Worker both use `shared/signup.ts`. Bad input returns per-field errors. The Worker does not log field values.

`src/analytics.ts` has a no-op `track()` for `form_started`, `field_error`, and `submitted`. Events carry a field name and error code, never the value typed into the form. Vite dev logs only the event name.
