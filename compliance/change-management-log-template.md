# Opt Out Texas — Change Management Policy & Log (DRAFT)

**Repo: PUBLIC, `TAYLORBEN89/privacy-optout-landing` (final, operator 2026-10-31).** Landing page, compliance docs (`/compliance`), and dashboard code (separate folder) share this repo. The dashboard code is still local only (`main`, `backend/d1-auth`) and must clear the checklist below before it is pushed.

## BLOCKING pre-publish checklist (all must pass before the first public push)
- [ ] **Remove the Cloudflare `account_id` and KV namespace `id` from `worker/wrangler.toml`** (supply them via CI variables or an untracked local config). Owner: Backend Agent, draft PR, the operator approves.
- [ ] Remove the placeholder D1 `database_id` the same way once a real D1 exists.
- [ ] Scan full git history with gitleaks/trufflehog; no secrets, `.env`, `.dev.vars`, or personal data. If any are found, rewrite history before publishing (the operator approves).
- [ ] Secret scanning + push protection, Dependabot alerts, and CodeQL (or equivalent) turned on as the repo is created.
- [ ] Branch protection on `main`: PR required, 1+ approving review, required status checks (tests, `check:sql`, dependency scan), no force-push, no direct pushes.
- [ ] SECURITY.md with a disclosure address, plus CONTRIBUTING.md.

## Policy
1. Agents open **draft PRs only**. Nothing merges or deploys without the operator's approval. The four-agent Review gate applies to every PR, and the security reviewer is a hard gate.
2. Every PR needs a description, a risk rating, the tests run, and a rollback plan.
3. Never commit secrets, tokens, `.env`/`.dev.vars`, Cloudflare account/KV/D1 IDs, or user data. Never put PII or incident details in public issues or PRs.
4. D1 schema changes go only through numbered migrations, reviewed like code.
5. The operator is the only one who deploys. Roll back with `wrangler rollback` or the previous Pages deployment. Emergency changes are logged within 24 h.

| Date | Change | Ticket/PR | Risk (L/M/H) | Approver | Tested (how) | Rollback plan | Deployed by |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD | | | | | | | |
