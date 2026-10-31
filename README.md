# Privacy Opt-Out Dashboard

DropTexas: a privacy opt-out tracker for Texans covering direct mail, data brokers, credit freezes, Do Not Call, and paid removal services.
Vite + React frontend, Cloudflare Worker + KV backend (source of truth), localStorage as an offline cache.

## Frontend setup
```bash
npm install
cp .env.example .env   # set VITE_API_URL (the Worker URL)
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
VITE_API_URL=https://privacy-dashboard-api.<your-subdomain>.workers.dev npm run build
npx wrangler pages deploy dist --project-name <project> --branch main
```

## Worker (Cloudflare) setup
```bash
cd worker
npm install
npx wrangler login                          # one-time, interactive
npx wrangler kv namespace create RECORDS    # paste the printed id into wrangler.toml
npx wrangler secret put API_TOKEN           # the access key you enter in the dashboard
# edit wrangler.toml: ALLOWED_ORIGIN (comma-separated list of origins) and (optionally) uncomment the privacy-api.example.com route
npx wrangler deploy
```
Local dev: `npx wrangler dev` (put `API_TOKEN=...` in `worker/.dev.vars`). Check: `npm run check` (dry-run).

API (all require `Authorization: Bearer <API_TOKEN>`):
- `GET /records` — list all
- `POST /records` — create (id optional)
- `GET|PUT|DELETE /records/:id`

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

- Tracking per broker: date sent, 45-day deadline (auto), status (sent, extended +45, completed, no data, denied, appealed +60, AG complaint), response notes. Overdue requests show in red with appeal / AG complaint guidance.
- Requests sync through the Worker at `/txrequests` (KV prefix `txreq:`).
- **Your identifiers** (name, aliases, addresses, phones, emails) live only in the Worker at `/settings/profile` (KV key `settings:profile`), edited from the "Your identifiers" panel. They are not in the site's code.
- **Refreshing the registry:** on the registry site click "Export to Excel", then use "Upload newer registry export" in the tab (XLSX or CSV). An uploaded list is kept in that browser only; to update the bundled list for all devices, replace `src/data/tx-brokers.json` and redeploy.

## Deploying updates

```bash
cd worker && npx wrangler deploy && cd ..
# .env must contain VITE_API_URL=https://privacy-dashboard-api.<your-subdomain>.workers.dev
npm run build && npx wrangler pages deploy dist --project-name privacy-dashboard-bt --branch main
```

Checklist categories now also include People-search sites, Search & apps, and Specialty reports (Innovis, LexisNexis Risk, ChexSystems, NCTUE freezes; 12-month re-verify). Add services in `src/services.js` as before.
