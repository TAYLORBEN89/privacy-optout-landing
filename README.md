# Privacy opt-out landing

v1 landing page for DROP Texas, a free privacy opt-out service for Texans. The intended public site is https://droptexas.com. The page is a Vite + React app. Cloudflare Workers serves the built files as static assets and handles `POST /api/signup`.

DROP Texas is an independent service. It is not affiliated with or endorsed by the State of Texas, the State of California, or the California Privacy Protection Agency. Do not deploy this preview.

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

`npm run worker:dev` is the same Wrangler command. Do not deploy. There is no persistence yet, and this repo has no secrets to configure.

`wrangler.jsonc` uses compatibility date `2026-10-30`, the newest date this repo's Wrangler binary accepts. Bump it when you upgrade Wrangler.

## Tests

```sh
npm test
```

`npm run typecheck` runs the TypeScript check that `npm run build` also runs.

## What the form does

The form collects full name, mailing address, email, and a Texas residency checkbox. The checkbox decides which state privacy law applies later. Non-Texans can submit. The flag is part of the validated payload and is not stored in this version.

The browser and the Worker both use `shared/signup.ts`. Bad input returns per-field errors. The Worker does not log field values.

`src/analytics.ts` has a no-op `track()` for `form_started`, `field_error`, and `submitted`. Events carry a field name and error code, never the value typed into the form. Vite dev logs only the event name.
