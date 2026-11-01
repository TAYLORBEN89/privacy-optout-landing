# Opt Out Texas — SOC 2 Roadmap (DRAFT)

Opt Out Texas is **built to SOC 2 standards**. It has no audit, report, or certification.

**SOC 2 Type 1:** a later milestone, not a day-one requirement. **Proposed (not committed) as-of date: April 30, 2027**, report around June 2027. No audit budget has been set. Scope: Security (Common Criteria) for a multi-user service. The operator approves all merges and deploys.

## Gaps (2026-10-31)
1. **Shared single access key blocks multi-user.** Per-user login + TOTP exists only on the unmerged branch `backend/d1-auth`. The legacy KV routes must be retired before launch. (CC6.1–6.3)
2. Texas requests and legacy KV data are not per user. Per-user D1 storage is approved but not built. (CC6.1, C1)
3. Daily purge (24 mo records, 3 y Texas requests, 24 mo inactive accounts) is approved but not implemented. (C1.2)
4. **Audit log:** the branch purges at 180 days and allows deletes. The approved rule is 12 months, append-only, with one expiry path: a scheduled Worker that deletes only rows older than 12 months and records each run in a separate maintenance log. Gap until the code is fixed. (CC7.2, CC4)
5. D1 not yet created remotely; no backups or restore test. (A1.2)
6. Monitoring: Workers Logs approved to be enabled (no bodies/PII; 3–7 day Cloudflare retention), not yet enabled; no alerting. (CC7.2)
7. Identifiers cached in plain text in browser localStorage. (CC6.7)
8. **No backup responder and no lawyer.** The operator is the sole responder, reviewer, and approver, so there is no segregation of duties. (CC1.3, CC7.4)
9. **Public repo, blocking:** dashboard code will live in a separate folder of the existing public repo `TAYLORBEN89/privacy-optout-landing`. The Cloudflare account ID and KV namespace ID are still in `worker/wrangler.toml` and must be removed (and history scanned) before that code is pushed. (CC8.1)
10. `ALLOWED_ORIGIN` includes `http://localhost:5173` in production config.
11. No risk assessment or Cloudflare vendor review yet. (CC3, CC9.2)
12. Landing copy must match shipped features (see texas-ag-flags.md).

## Public-repo risks
- Infrastructure IDs in config help attackers target the account (blocking item above).
- Git history is permanent once public; scan it first. A quick check on 2026-10-31 found no `.env`/`.dev.vars` commits, and the email-like strings were broker contacts and test fixtures only. A full gitleaks scan is still required.
- Rate limits, session lifetimes, and purge logic become visible. That's acceptable if they are sound; publish SECURITY.md first.
- Anyone, including the Texas AG, can compare marketing claims with the code, so claims must match `main`.

## Phases
| Phase | Target | Work | TSC |
|---|---|---|---|
| 0 Foundations | Nov 2026 | Clear the blocking pre-publish checklist, create the public repo, branch protection, secret scanning, Dependabot; adopt policies; risk assessment | CC1–3, CC8 |
| 1 Per-user auth | Nov–Dec 2026 | Merge D1 auth via Review gate; create D1; per-user Texas requests; retire shared key | CC6 |
| 2 Data lifecycle | Jan 2027 | Daily purge with all approved rules; append-only 12-month audit log with maintenance-logged expiry; inactive-account warnings; Workers Logs on; backups + restore test | C1, A1, CC7 |
| 3 Monitoring & IR | Feb 2027 | Logs and alerts, IR tabletop | CC4, CC7 |
| 4 Readiness | Mar–Apr 2027 | Cloudflare vendor review (their SOC 2 report), Pen Test Agent findings, evidence folder | CC9 |
| 5 Type 1 (milestone) | Proposed as-of 2027-04-30; report ~June 2027 | Engage an auditor once budget is approved | Security |

## Tooling: free/manual (no paid platform for now)
- Policies and evidence: these Markdown docs in the repo, with a dated `/evidence` folder (screenshots, exports).
- Tracking: GitHub Issues/Projects for controls and the change log; PR history as change evidence.
- Security scanning: GitHub secret scanning, push protection, Dependabot, CodeQL (free on public repos); gitleaks in CI.
- Access reviews: monthly checklist plus Cloudflare/GitHub audit-log exports.
- Reminders: calendar entries for access review, rotation, and tabletop.
- **Deferred:** paid compliance platforms (Vanta, Drata, Secureframe, etc.) and an external pen test. Revisit when the Type 1 is scheduled.
- **Audit fee:** no amount set. For context only, published small-company Type 1 fees run roughly $7,500–$15,000 (Drata, drata.com/learn/soc-2/cost), an estimate rather than a budget.
