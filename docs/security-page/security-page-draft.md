<!--
DRAFT — NOT FOR PUBLICATION. Do not deploy without Ben's approval.

Before publishing, each of these must be true (verify, then move the item out of "What we're still building"):
1. help@droptexas.com actually receives mail (it must be added as an iCloud custom-domain address; send a test).
2. The account-based app (backend/d1-auth + feat/* branches) is merged and deployed to production, replacing the
   shared-access-key KV API. Today production has no MFA, no sessions, no purge, no audit log and no Workers Logs.
3. localStorage cleanup (feat/frontend-no-local-pii) is live; until then identifiers are cached in plain text in the browser.
4. Production ALLOWED_ORIGIN no longer contains http://localhost:5173 (feat/dev-only-localhost).
5. A real D1 database is bound (wrangler.toml still has a placeholder ID) and the daily purge cron is running.
6. Audit log: append-only triggers (feat/audit-log-retention, migration 0004) live, AND the IP + user-agent columns built.
7. Inactive-account deletion + warning email (feat/inactive-accounts) live.
8. The 3-business-day acknowledgment target is confirmed by Ben (placeholder below).
9. Privacy policy updated by Compliance (audit-log IP/UA row) and linked from this page.
10. Re-read every "Live" statement against production on the day of publishing (Texas DTPA: no misleading claims).
-->

# Security at DROP Texas

_Last updated: October 31, 2026_

DROP Texas is a free service that helps Texans ask data brokers to delete their personal information. You're trusting us with exactly the kind of data you're trying to get back under control, so this page explains how we protect it. We've tried to be specific, and we tell you plainly what isn't finished yet.

**How to read this page:** each section is marked **Live** (running on droptexas.com today) or **Planned, not live yet** (built or approved, not yet in production). If something is marked Planned, not live yet, don't rely on it yet.

> **Current status (Oct 31, 2026):** The account system described below (MFA, server-side sessions, automatic deletion, audit log) is built and tested but **not yet in production**. Until it ships, the existing app uses a single shared access key and caches some identifiers in your browser's local storage. We'll update this page when that changes.

## Connections to the site — Live

- All traffic to droptexas.com goes through Cloudflare. HTTP requests are redirected to HTTPS ("Always Use HTTPS").
- We accept TLS 1.2 or newer only. Older protocols are refused.
- Cloudflare connects to our servers over HTTPS with certificate validation ("Full (strict)").
- Not yet: HSTS (a header telling browsers to always use HTTPS). We'll turn it on once the full site is live.

## What we store, and how — Planned, not live yet

We collect only what an opt-out request needs.

| Data | Why | How it's protected |
|---|---|---|
| Account email | To sign in | Stored in plain text today; hashing it at rest is **planned** |
| Password | To sign in | Never stored; we keep a salted PBKDF2-SHA256 hash (100,000 iterations) |
| Authenticator (TOTP) secret | MFA | Encrypted with AES-GCM using a dedicated key |
| Backup codes | MFA recovery | Only a SHA-256 hash; you see the codes once |
| Session | Keep you signed in | Only a SHA-256 hash of the session token, plus a CSRF token and timestamps |
| Identifiers for a request (name, addresses, phones, emails) | Sent to brokers | AES-GCM encrypted with a separate, versioned key, tied to the specific record so it can't be swapped onto another |
| Opt-out records | Track progress | Broker, status, dates, re-verify date, notes |
| Confirmations | Proof a broker acted | Confirmation number, channel, time |
| Texas (TDPSA) requests | Track legal deadlines | Broker, date sent, deadline, status, notes |
| Rate-limit counters | Stop abuse | Keyed by a hash, expire automatically |
| Server logs | Debugging | Time, method, path, status, errors. No request bodies, cookies, tokens or personal data |

**No third-party analytics, advertising, or tracking scripts. We do not sell personal data, use it for targeted advertising, or profile you.** If we ever add an analytics provider, we'll update this page and our privacy policy first.

Data is stored in Cloudflare D1 and Workers KV. Cloudflare encrypts these at rest ([Cloudflare docs](https://developers.cloudflare.com/d1/reference/data-security/)); our own AES-GCM encryption above is in addition to that.

**Known gap (Live today):** the current app caches some identifiers in plain text in your browser's local storage. The new version removes that and keeps them only on the server, encrypted. We don't claim everything is "encrypted everywhere."

## Signing in — Planned, not live yet

- **Two-step sign-in (MFA) is required.** After your password, you enter a 6-digit code from an authenticator app. You set it up by scanning a QR code, and you get 10 one-time backup codes.
- **Codes can't be reused.** Each code is accepted once; a replayed code is rejected, even if two requests arrive at the same moment.
- **Same answer for every failure.** A wrong email, password or code all return the same "invalid credentials" message, and unknown emails take the same time to check, so attackers can't learn who has an account.
- **Server-side sessions.** Your browser holds only a random token in a `__Host-` cookie that's HttpOnly (scripts can't read it), Secure and SameSite=Strict. Sessions end after 12 hours idle or 7 days at most. Tokens are replaced (rotated) when your security level changes; if an old token is ever reused, we sign out every session on the account.
- **Forged-request protection.** Every change (POST/PUT/PATCH/DELETE) needs a per-session CSRF token and must come from our own site's Origin; requests without one are refused.
- Sign-in options may change before launch.

## Limits on abuse — partly Planned, not live yet

- **Planned, not live yet:** after 5 failed sign-ins (password or code) from the same IP for the same account in 15 minutes, further attempts are blocked.
- **Planned, not live yet:** opt-out changes are limited to 30 per hour per account.
- **Planned:** an additional per-account limit, to stop attacks spread across many IP addresses.

## How long we keep things — Planned, not live yet (approved, not yet running)

Planned, not live yet: a daily automatic job will delete data on this schedule:

- Identifiers used for a request: deleted 30 days after the broker confirms, and never kept more than 90 days.
- Finished opt-out records: deleted 24 months after completion.
- Texas TDPSA request records: deleted 3 years after their final status.
- Security audit log: kept 12 months (see below).
- Server logs: Cloudflare's default retention (currently 3 days; 7 days from December 1, 2026)<!-- CONFIRM Workers plan is Free before publishing; confirm traces capture no bodies, headers, or PII -->.
- Inactive accounts: deleted after 24 months without a sign-in, with a warning email 30 days before. Deleting an account removes all of its per-user data.

Backups — **Planned:** scheduled database exports to separate storage. Not running yet.

## Audit log — Planned, not live yet

We record security-relevant events: sign-ins, MFA changes, backup-code use, profile updates, opt-out status changes, and suspicious session reuse. Each entry has the user, action, target, time, IP address and browser user-agent (recording IP and user-agent is approved but **not yet built**).

The log is append-only: the database itself rejects edits and deletions. The only way entries are removed is an approved scheduled job that deletes entries older than 12 months and records each run in a separate append-only maintenance log.

## Building it safely

- **Built, not yet in production:** every database query uses prepared statements with bound parameters, and a check script fails if a query is built by string concatenation. **Planned:** running that check in CI on every change.
- **Planned:** automated dependency scanning (npm audit and Dependabot).
- **Process:** changes go through pull requests on a protected main branch (enforced on GitHub today); nothing reaches production without explicit approval.
- **SOC 2:** Built to SOC 2 standards. It is not audited and not certified.

## If something goes wrong

If we determine a breach of personal information occurred, we will notify affected people without unreasonable delay and within 60 days (Tex. Bus. & Com. Code §521.053), notify the Texas Attorney General within 30 days if 250 or more Texans are affected, and notify the consumer reporting agencies if more than 10,000 people are notified. We write an internal post-mortem within 14 days.

## Reporting a security issue

Email **help@droptexas.com** with "Security" in the subject. Include steps to reproduce and what you think the impact is.

**In scope:** droptexas.com, www.droptexas.com, and the DROP Texas API.

**Please:**
- Use only your own account or test accounts. Don't access, change or keep other people's data; if you hit any by accident, stop and tell us.
- No denial-of-service, spam, or heavy automated scanning.
- No social engineering, phishing, or physical attacks.
- Give us reasonable time to fix the issue before telling others.

**What we'll do:** acknowledge your report within **3 business days** [PLACEHOLDER — Ben to confirm], keep you updated, and credit you if you'd like.

**Safe harbor:** if you act in good faith and follow these guidelines, we won't pursue legal action against you or report you to law enforcement for your research, and we'll consider it authorized.

**No bug bounty:** we're a free service and can't pay rewards.

## What we're still building

Server-side accounts with MFA; removing browser-stored identifiers; blocking development origins in production; automatic deletion; append-only audit log with IP/user-agent; per-account login limits; email hashing at rest; backups; CI query checks and dependency scanning; HSTS. Each will move to "Live" on this page only once it's running in production.

## Changelog

- **Oct 31, 2026:** First draft. Transport protections (HTTPS redirect, TLS 1.2+, Full strict) live; account security and retention marked Planned, not live yet.
