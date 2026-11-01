# DROP Texas — Code & Config Changes Required by the operator's Decisions (2026-10-31)

All items: **Owner: Backend Agent.** Each goes in as a **draft PR** through the four-agent Review gate, and **the operator approves before merge**. The operator is the only one who deploys. The Compliance Agent changes no code.
**Where:** the dashboard code goes into a separate folder of the public repo `TAYLORBEN89/privacy-optout-landing`. Item 6 and a full history scan must be done **before** the code is pushed.

| # | Change | Where (current state) | Decision |
|---|---|---|---|
| 1 | Daily purge: delete finished opt-out records (`confirmed`/`denied` + `confirmations`) 24 months after final status | `worker/src/app.js` `purge()`; cron already daily `0 8 * * *` on branch | 24 mo; daily |
| 2 | Daily purge: delete Texas TDPSA requests 3 years after final status | Needs item 5 | 3 y |
| 3 | Identifier purge at 30 days after confirmation, 90-day hard max; remove "decision pending" comment | `wrangler.toml` `PII_RETENTION_DAYS=30`, `PII_HARD_MAX_DAYS=90`; logic exists on branch | 30 / 90 d |
| 4 | Audit log 12 months, append-only: `AUDIT_RETENTION_DAYS=365`; D1 triggers blocking UPDATE/DELETE on `audit_log` except via the single scheduled expiry path (rows older than 12 months only); new `maintenance_log` table (run time, cutoff, rows deleted, job) written on every expiry run; tests proving other deletes fail | `wrangler.toml` `AUDIT_RETENTION_DAYS="180"`; `purge()` deletes; no triggers or maintenance log | 12 mo, no deletes, one logged expiry path |
| 5 | Texas requests in per-user D1 rows: migration `tx_requests` (`user_id` FK ON DELETE CASCADE, broker, status, sent_at, deadline, final_at, notes); routes; migrate legacy KV `txreq:*`; retire KV collection | Shared KV `txreq:` via `legacy.js` | Per-user D1 (confirmed) |
| 6 | Remove Cloudflare `account_id`, KV namespace `id`, and placeholder D1 `database_id` from `worker/wrangler.toml`; supply via CI vars or untracked local config | `worker/wrangler.toml` | **Blocking before code push** |
| 7 | Remove `http://localhost:5173` from production `ALLOWED_ORIGIN`; dev origin only in `.dev.vars`; add droptexas.com when live | `wrangler.toml [vars]` | Production origins only |
| 8 | Inactive accounts: add `last_login_at`; send a warning email 30 days before deletion (needs an email-sending path, e.g. Cloudflare Email Service or iCloud Mail custom-domain SMTP; record `warned_at`); delete (cascade) at 24 months inactive | Not present | 30-day warning, 24-mo deletion |
| 9 | Enable Cloudflare Workers Logs: `[observability] enabled = true` in `wrangler.toml`; never `console.log` request bodies, identifiers, emails, or tokens (audit existing `console.error('app error', e.stack)` so stacks never include PII); consider `head_sampling_rate`; add a test/lint for PII in logs | Not enabled in config | ON, no bodies/PII (config change) |
| 10 | (Supporting) Retire legacy shared-`API_TOKEN` routes after migration | `src/legacy.js`, `src/index.js` | Required for multi-user |
| 11 | (Supporting) Stop caching identifiers in plain-text localStorage | `src/storage.js` `PROFILE_CACHE` | Data minimization |
| 12 | (Supporting) Honest UI copy: "Completed / deleted" → "Broker reports completed" | `src/TexasBrokers.jsx` line 13 | Honest claims |
