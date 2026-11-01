# DROP Texas — Monthly Access Review Checklist (DRAFT)

Month: ______ · Reviewer: the operator (sole reviewer; there is no second reviewer) · Date: ______

**Cloudflare (account ID recorded privately, not in the repo)**
- [ ] Members/roles minimal; MFA on all
- [ ] API tokens (including agent/CI tokens): delete unused ones, least privilege, expiry set
- [ ] Audit log checked for unexpected deploys, D1/KV changes, secret changes
- [ ] Workers Logs (observability) still enabled; sample shows no request bodies, identifiers, or emails
- [ ] `ALLOWED_ORIGIN` lists production origins only (no `http://localhost:5173`)
- [ ] Inventory: Worker `privacy-dashboard-api`, KV `privacy-dashboard-api-RECORDS`, D1 (once created), Pages `privacy-dashboard-bt`, droptexas.com zone (once live)

**Application users**
- [ ] Legacy shared `API_TOKEN` routes retired? (Required before multi-user launch)
- [ ] Operator/admin accounts listed; all have TOTP
- [ ] audit_log reviewed (`session.reuse_detected`, `totp.fail` spikes); audit_log is still append-only and holds 12 months
- [ ] Deletion requests completed within 45 days
- [ ] Daily purge ran; audit-log expiry runs recorded in `maintenance_log` and deleted only rows older than 12 months
- [ ] Inactive-account warning emails sent 30 days before 24-month deletion

**GitHub (public repos)**
- [ ] Collaborators, deploy keys, GitHub Apps, Actions secrets reviewed
- [ ] Branch protection on `main` intact
- [ ] Secret scanning + push protection on; no open alerts
- [ ] Dependabot/CodeQL alerts triaged
- [ ] No secrets, Cloudflare account/KV/D1 IDs, `.env`/`.dev.vars`, or PII in repos or history
- [ ] Account MFA on

**Supabase / Vercel:** not used by DROP Texas (checked 2026-10-31). Confirm still N/A.

**iCloud Mail (droptexas.com custom domain):** Apple ID two-factor on, help@droptexas.com address exists and receives mail, forwarding rules for help@droptexas.com reviewed.

**Secrets rotation**
- [ ] `API_TOKEN` 90 days old or less (rotate on any leak); `TOTP_ENC_KEY` reviewed annually
- [ ] Password manager and recovery codes current

**Offboarding:** anyone or any agent removed loses accounts, tokens, and repo access within 24 h.

**Sign-off:** ______ Date ______ Exceptions logged: Y/N
