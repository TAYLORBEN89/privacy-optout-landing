# DROP Texas — Data Retention & Disposal Standard (DRAFT)

All periods **approved by the operator 2026-10-31**. The **daily** purge job is approved in principle and is **approved, not yet implemented** until it ships through a operator-approved draft PR (see code-changes-needed.md).

## Current state (verified 2026-10-31)
- **Production:** Worker `privacy-dashboard-api` + KV `privacy-dashboard-api-RECORDS`. Single shared `API_TOKEN`. No cron, no TTLs (0 of 58 keys expire), no backups.
- **Local branch `backend/d1-auth` (unmerged, no remote, not deployed):** D1 schema plus a daily cron `0 8 * * *` that deletes identifier payloads (30 days after confirmation / 90-day max), expired sessions, and **audit_log rows older than 180 days**. That last part conflicts with the approved 12-month append-only rule (gap). It does not yet purge finished records, Texas requests, or inactive accounts. The D1 ID is a placeholder.

## Retention table (per user)
| Data element | Store | Rule | Status |
|---|---|---|---|
| Identifier payloads (`pii_payloads`) | D1, encrypted | Delete 30 d after confirmation; 90 d hard max | Coded on branch, not deployed |
| Finished opt-out records (`optout_requests` + `confirmations`; legacy KV `record:*`) | D1 / KV | Delete 24 months after final status | Approved, not yet implemented |
| Texas TDPSA requests | Per-user D1 rows (confirmed; today shared KV `txreq:*`) | Delete 3 years after final status | Approved, not yet implemented; per-user D1 not yet live |
| Inactive accounts (`users`, cascades) | D1 | Warning email 30 days before deletion; delete after 24 months with no sign-in | Approved, not yet implemented |
| Security audit log (user id, action, target, time, IP, user-agent; approved by Ben 2026-10-31) | D1 | Keep 12 months; append-only, no updates or deletes. **Only approved expiry path:** a scheduled Worker that deletes rows older than 12 months and records each run (time, cutoff, rows deleted) in a separate `maintenance_log` table | Approved; **gap:** branch purges at 180 d, allows deletes, and has no maintenance log |
| Cloudflare Workers Logs | Cloudflare | Enabled with no request bodies or PII. Retention = Cloudflare default: 3 days (Workers Free) / 7 days (Paid) today; 7 days on all plans from Dec 1, 2026 (developers.cloudflare.com/workers/observability/logs/workers-logs/ and /observability/pricing/, checked 2026-10-31) | Approved, not yet enabled |
| Maintenance log | D1 `maintenance_log` | Keep 12 months (same expiry job) | Approved, not yet implemented |
| Sessions | D1 | 12 h idle / 7 d absolute; rows removed 7 d after expiry | Coded on branch, not deployed |
| Rate-limit counters `rl:*` | KV | `expirationTtl` = window | Coded on branch, not deployed |
| Legacy profile `settings:profile` | KV | Migrate to per-user encrypted store, then delete | Proposed |
| Browser localStorage | User device | Cleared on logout; stop caching identifiers in plain text | Proposed |
| Backups | TBD | Encrypted export kept 90 d | Proposed (none exist) |

## Purge job (approved design)
**Daily** Worker cron (`0 8 * * *`, 2–3 AM Central). Uses prepared statements only and logs counts, never PII. Each run writes one audit_log row. The audit-log expiry step deletes only `audit_log` rows older than 12 months and records the run (time, cutoff, row count) in `maintenance_log`; no other code path may update or delete audit rows. Owner: Backend Agent, via draft PR, Review gate, the operator approves the merge and deploy.

## Deletion-on-request flow
1. Request arrives through in-app "Delete my account" (planned) or by email to the privacy contact.
2. Verify identity with a signed-in MFA session or a reply from the account email. Responses are uniform (no account enumeration).
3. Log it with the due date (+45 d).
4. Delete the `users` row, which cascades to sessions, requests, confirmations, Texas requests, and identifiers. Delete any legacy KV keys.
5. Keep a minimal audit_log entry (`account.delete`, user id, time, IP, user-agent), with no request identifiers, for its 12 months.
6. Backups age out within 90 d; this is disclosed.
7. Confirm in writing and record it in the change log.
