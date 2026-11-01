# DROP Texas — Texas DTPA / AG Risk Flags (updated 2026-10-31)

**Approved language rule (operator, 2026-10-31):** only **"built to SOC 2 standards"**. "SOC 2-ready", "SOC 2 compliant/certified", and "working toward SOC 2" are not approved.
**Landing copy decision:** tone it down. Honest claims only, until the features exist.

**Scope scanned:** compliance docs; `/workspace/privacy-dashboard` (README, src, worker, branch `backend/d1-auth`); deployed `privacy-dashboard-bt.pages.dev`; `/workspace/privacy-optout/` (BRIEF.md, brokers-basic-info.md, automation-plan.md, ca-drop-study.md); public GitHub repo `TAYLORBEN89/privacy-optout-landing` (the single repo for landing, docs, and dashboard code; README only at scan time: "Landing page for a free privacy opt-out service for Texans"; no risky claim, as long as the service stays free). No "bank-level security", "guaranteed removal", or "SOC 2 certified" claims found in any shipped copy.

## Flags
| # | Quote | Location | Why risky | Honest rewrite (use until the feature exists) |
|---|---|---|---|---|
| 1 | "SOC 2-ready" | BRIEF.md, SECURITY section (**fixed 2026-10-31**: replaced with "built to SOC 2 standards"); keep flagging anywhere it reappears in landing or security copy | Not approved. Implies an assessed readiness that hasn't happened. | "Built to SOC 2 standards. Not audited." |
| 2 | "Privacy is not only a right, but we're willing to do it for you free of charge." | BRIEF.md core pitch (intended landing headline) | The app doesn't file requests for users. It tracks them and drafts emails the user sends. | "Privacy is your right. DROP Texas gives you free tools to send opt-out and deletion requests to data brokers and track every reply." |
| 3 | "Proof-of-deletion reports (… before/after screenshots)" | BRIEF.md pitch; screenshots only planned in automation-plan.md | No screenshot capture exists, and a broker confirmation isn't proof of deletion. | "A record of every request: the date sent, the 45-day deadline, and any confirmation number or reply the broker gives you." |
| 4 | "Speed to new brokers via weekly crawl detection" | BRIEF.md pitch | No crawler exists. | "Our broker list comes from the Texas Secretary of State data broker registry and is updated by hand when the registry changes." |
| 5 | "detect GPC and auto-file opt-outs" / automatic opt-out lanes | BRIEF.md legal section; automation-plan.md | Nothing is filed automatically today, and GPC isn't detected. | "You send each request yourself; we prepare the text and remind you of deadlines. Automatic filing is not available yet." |
| 6 | "Immutable audit logs", "auto-purge PII after completion" | BRIEF.md security section (if reused on a security page) | The branch's audit log is deletable and purged at 180 days; the purge isn't deployed. | Describe only shipped controls, e.g. "Security logs are kept for 12 months" once the code does that. |
| 7 | "Free vs DeleteMe's $129-299/year" | BRIEF.md pitch | Competitor price comparisons must be current and sourced, and the services aren't equivalent (DeleteMe files for you). | Drop it, or "DeleteMe lists plans from $X/yr (checked DATE, source)" with a note that it is a done-for-you service. |
| 8 | "Your identifiers … live only in the Worker" | privacy-dashboard README.md | False: they are also cached in browser localStorage. | "Stored in the Worker and cached in this browser for offline use." |
| 9 | Status label "Completed / deleted" | privacy-dashboard src/TexasBrokers.jsx line 13 | Implies verified deletion. | "Broker reports completed" |
| 10 | "We respond within 45 days", rights section | privacy-policy.md §5 | A promise that can be enforced; it needs a working contact and request log. | Publish only after the contact inbox and request log exist. |
| 11 | Additional "Do NOT claim" list (e.g. "guaranteed removal", "official", "DROP for Texas", "SOC 2 compliant") | /workspace/privacy-optout/ca-drop-study.md | Good guidance; adopt it as the landing-copy ban list. | No change. |

## Going public on GitHub
A public repo lets anyone, including the AG, compare marketing and security-page claims with the code. Every public claim must match what is on `main` and deployed. Blocking item before publishing: remove the Cloudflare account ID and KV namespace ID from `worker/wrangler.toml` (see change-management-log-template.md).

**Brand name risk (accepted by Ben 2026-10-31):** the brand is "DROP Texas". "DROP" matches California's official Delete Request and Opt-out Platform (DROP). Ben chose it after being told about the confusion risk. Mitigation: show the independent-service notice prominently on every page (private, free service run by an individual; not a government website; not affiliated with the State of Texas, the Texas Attorney General, the State of California, or the California Privacy Protection Agency). Never use government seals, .gov-style styling, or wording like "official".
