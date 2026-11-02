# privacy-optout-landing
Landing page for a free privacy opt-out service for Texans (Vite/React on Cloudflare Workers)

## AI agent team & handoff (as of Nov 1, 2026, 8 PM CT)

> Purpose: let a fresh session (e.g. a local CLI agent) pick up exactly where the agent team stopped.
> **All agents are currently PAUSED at the owner's request** while the owner edits branches locally. Nothing is to be merged, pushed, rebased, or deployed until the owner says "resume". On resume: first find out which branches the owner touched locally and re-run the Review gate on those.

### 1. Project goal & strategy
- **DROP Texas** (droptexas.com): a free privacy opt-out dashboard for Texans. Pitch: privacy is a right, and we help you exercise it free of charge.
- **Automate-first**: lanes are (a) fire-and-forget plain POST forms (DMAchoice, Catalog Choice, Do Not Call, TruePeopleSearch, FastPeopleSearch), (b) human-gate (credit bureaus, state portals: pre-filled, user confirms), (c) "messy middle" brokers needing email verification (inbox pool), (d) credit freezes (separate portals; KYC not automatable), (e) paid services: track renewals only.
- **Proof of deletion**: confirmation numbers, timestamps, before/after screenshots. Weekly crawl to detect new brokers.
- **Legal basis**: Texas TDPSA (6 rights incl. appeal; 45-day response + 45 extension; GPC accepted as an opt-out signal). Texas data broker registry is registration-only, no deletion portal. Seed list merges CA/TX/OR/VT registries + Privacy Rights Clearinghouse.
- **Positioning**: operated by a *private enterprise*; **no government affiliation**. Follows the rules and plain style of California's DROP (Delete Request and Opt-out Platform) as a model. Do not reopen the "private enterprise" wording.
- **DTPA risk**: avoid "we send it for you" claims the product doesn't yet fulfil; prefer "tools you use to send" wording.
- Cost target ~zero (Cloudflare + GitHub free tiers).

### 2. Stack
- Cloudflare Workers (landing Worker + backend Worker `privacy-dashboard-api`), D1 (`privacy-dashboard`), KV, Cloudflare Email Sending/Routing.
- Landing → backend via **service binding `env.API`** (currently OFF, see §7).
- Custom-domain routes via wrangler; `workers_dev = false`, `preview_urls = false`. Cloudflare IDs kept out of `wrangler.toml` (PR #2). Secrets only via env vars / wrangler secrets (e.g. `CLOUDFLARE_API_TOKEN_DROPTEXAS` — name only, value never printed or committed).
- Auth: email/password + TOTP (otplib), Google and Microsoft OAuth, sessions with expiry/rotation, CSRF tokens, uniform errors.
- Rate limiting: D1 counter, atomic `UPSERT ... RETURNING`, reserve-then-verify with refund on success. Limits: login 5 / 15 min; opt-out writes 30 / hour / user (400s and 404s count); Texas edits 1000 / hour. Client IP from `CF-Connecting-IP` (landing binding forwards the original Request).

### 3. Standing rules (apply to every agent and any new session)
1. No code changes without the owner's explicit permission.
2. All agents report through B; the owner only hears about things needing a yes. Batch the rest.
3. Draft PRs only. No direct pushes to `main`.
4. Every PR passes the Review gate before merge. Never merge or deploy without the owner's explicit approval.
5. Prepared statements on every D1 query; no string concatenation in the data path.
6. Never print, commit, or save secrets.
7. Pen testing on **staging only**, never production.
8. SOC 2 wording: "built to SOC 2 standards" / "SOC 2-ready" only; state it is **not audited and not certified**.
9. No "individual" wording for the operator; the owner's name never appears on the site or in public copy ("private enterprise").
10. Relay rule: B may relay the owner's OKs to agents. Backend and Landing Page agents still prefer the owner's own words in their chats for code/merge/deploy; Review Agent accepts B's relay.

### 4. Agents

| Agent | Role / job | Goals | Done so far | Where it stopped | Next planned steps | Waiting on |
|---|---|---|---|---|---|---|
| **B** (boss / coordinator) | Coordinates all agents, batches reports into one digest, gates approvals, relays owner OKs, triggers Pen Test on demand | Keep the deploy moving safely; only bother the owner for yeses | Drove import (#1/#2), rate-limit fix (#22/#23), migration 0008 + backend deploy, landing deploy 14 | Paused all agents on owner's request | On resume: ask which branches the owner changed, re-gate them; continue merge order (§6); send one short digest of pending decisions (§9) | Owner "resume"; ready-for-review confirmations on #1/#2; A/B answer on #17 |
| **Landing Page Agent** | Front-end (Vite/React) landing site, copy, forms, deploys of landing Worker | Clear, honest, DTPA-safe landing page; signup form; ship and iterate | UI batch #12, copy fixes #17, deploy 14 live | Paused; #17 has 7 copy conflicts against #12's branch | Resolve #17 conflicts per owner's A/B choice, request re-gate; then merge #17 → #12 branch → `main` (approved); later turn on `env.API` | Owner A/B choice; owner's go on binding |
| **Backend Agent** | `privacy-dashboard-api` Worker, D1 schema/migrations, KV, opt-out queue, confirmation logging, auto-purge cron, auth/TOTP/OAuth, sessions, rate limiting, CSRF | Secure, minimal-data backend with prepared statements everywhere | D1 rate limiter (#22, #23), migration 0008 applied, backend deployed | Paused; #24 (signup payload fix) open | Land #24; resolve #7/#9 migration renumber conflict; duplicate-row precheck before migration 0011; support binding + 429 smoke test | Review results on #24/#9; owner decisions (TOTP for social sessions, etc.) |
| **Review Agent** | Gate on every PR with 4 checks: Reviewer, Security (hard gate), Test-writer, Docs. Posts results as COMMENT reviews | Nothing merges without a PASS | PASS on #1, #2, #12, #17 (pre-conflict) | Paused | Results for #9 and #24; docs re-gate on #7; re-gate #17 after conflict fix; re-gate any branch the owner touched locally | Agents/owner to finish changes |
| **Pen Test Agent** | Read-only probes on staging: SQLi, rate limits, enumeration, CSRF, secret leaks, session expiry, MFA gates, proxy bypass; ranked findings | Find issues before prod | Staging runs Oct 31 and Nov 1; High (login rate limit) fixed via #22/#23 | Idle | Re-test after binding is on; confirm live 429 behaviour | Binding on + owner OK |
| **Compliance Agent** | Privacy policy, retention, incident response, change log, access review, SOC 2-readiness pack and roadmap; TDPSA mapping; COPPA flags | Honest, defensible legal/compliance language | SOC 2-readiness artifacts, TDPSA rights mapping, flagged COPPA for DOB / child-under-13 fields | Paused | COPPA + retention review before DOB/child storage goes live | Owner decisions (COPPA/retention, branch `compliance/soc2-readiness-pack` deletion) |
| **Cybersecurity Agent** | Security posture: secret hygiene, GitGuardian alerts, credentials, history hygiene | No leaked secrets; clean history | Triaged GitGuardian 39368814 as false positive (`password:step_up` label) | Paused | Act on owner decisions: dismiss alert, history rewrite, scrub local paths from repo, delete old Entra secret, delete backups | Owner decisions |

### 5. Live deploy state
- **Landing**: deploy 14, commit `4d24e66`, Worker version `2c0581c8`. Rollback target `c313291c` (deploy 13); earlier: deploy 11 `3dd81842`, deploy 10 `e88f87dd`.
- **Backend** `privacy-dashboard-api`: version `cc3b2d1f`, rollback `4736795c`.
- **D1** `privacy-dashboard`: migration 0008 applied; `rate_limits` table has 0 rows.
- `main` at `9dc85e8`; `import/initial-code` at `408b0bf` (includes #22 `1cff27e`, #23 `408b0bf`).

### 6. Open PRs

| PR | What | Head | Review | Next action |
|---|---|---|---|---|
| #2 | Cloudflare IDs out of `wrangler.toml` (base `import/initial-code`) | `9fe566e` | PASS | Owner-approved; mark ready, merge **first** |
| #1 | Import `import/initial-code` into `main` | `408b0bf` | PASS | Merge after #2. GitGuardian 39368814 = false positive |
| #17 | Copy fixes (base = #12's branch) | `27a6db2` | PASS (pre-conflict) | 7 copy conflicts. Owner picks **A** (keep #12 wording, drop guard test) or **B, recommended** (keep #12 wording but swap the "for you" lines — "We handle the broker forms so you don't have to", "One form, then we take it from there", "DROP Texas sends opt-out requests to data brokers for you", "send your requests" — for #17's "tools you use to send" versions, keep the guard test). Then re-gate, merge into #12 branch |
| #12 | Landing UI batch (base `main`) | `ad82bb0` | PASS | Owner-approved; merge after #17 lands in it. Check conflicts with #1 on `main` |
| #24 | Backend signup payload fix | — | Pending | Needs Review result; gates `env.API` binding |
| #7 | Auth/session work (social sessions skip TOTP on older routes) | — | Docs re-gate pending | Owner decision on TOTP; migration renumber vs #9 |
| #9 | Backend feature w/ migration | — | Pending | Review result; renumber conflict with #7 |
| #4, #5 | Earlier PRs | — | — | Owner decision to merge |
| #16, #18, #20 | Earlier/superseded PRs | — | — | Hold; confirm status on resume |
| #21 | — | — | — | Owner decision |

**Approved merge order**: #2 → `import/initial-code`, then #1 → `main`. #17 → #12's branch, then #12 → `main`.

### 7. `env.API` binding hold & 429 smoke test
- Owner instruction: hold the `env.API` service binding until Backend's payload fix (#24) is live, then ask the owner.
- After the binding is on: verify `CF-Connecting-IP` reaches the backend, then a login smoke test — the 6th attempt within 15 min must return **429**.

### 8. Migration notes
- #7 and #9 both claim the same migration numbers; renumber one before merging.
- Before migration 0011: run a duplicate-row precheck (read-only query) so a new unique index won't fail.

### 9. Pending owner decisions
1. Social (Google/Microsoft) sessions skipping TOTP on older routes (#7, #9).
2. Merge #4 and #5.
3. COPPA + retention review for DOB and child-under-13 fields.
4. #21.
5. Dismiss GitGuardian 39368814 (false positive).
6. Delete branch `compliance/soc2-readiness-pack`.
7. Git history rewrite.
8. Scrub local user paths from the repo.
9. Delete the old Entra (Microsoft) client secret.
10. Phone field label.
11. Delete backups.
12. #17 copy choice A vs B.
13. Turn on `env.API` once #24 is live.
