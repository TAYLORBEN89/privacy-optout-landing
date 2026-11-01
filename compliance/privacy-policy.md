# DROP Texas — Privacy Policy (DRAFT)

**Operator:** Benjamin Taylor, Texas · **Site:** droptexas.com (planned; domain not yet live)
**Privacy contact:** help@droptexas.com (not published until help@droptexas.com is set up as an iCloud Mail custom-domain address and a test message is received)
**Effective date:** [set on publication]
**Security statement:** DROP Texas is built to SOC 2 standards. It has not been audited and holds no SOC 2 report or certification.

> Facts come from (2026-10-31): the deployed Worker + KV (read-only Cloudflare check) and the unmerged local branch `backend/d1-auth`. Anything marked **(planned)** is not live. **Do not publish this policy until per-user accounts are live.** Production still uses one shared access key.

## 1. What we collect, per user
| Data | Why | Where |
|---|---|---|
| Account: email (stored in plain text; hashing at rest planned), password hash (PBKDF2-SHA256), encrypted TOTP secret, created time | Unique login + required MFA | D1 `users` (planned) |
| MFA backup codes (SHA-256 hashes only; shown to you once) | MFA recovery | D1 (planned) |
| Sessions: hashed token, CSRF token, timestamps | Keep you signed in safely | D1 `sessions`; 12 h idle / 7 d max (planned) |
| Opt-out requests: broker, status, dates, re-verify date, notes | Track each request | D1 `optout_requests` (planned) |
| Confirmations: confirmation number, channel, time | Record of what the broker told us | D1 `confirmations` (planned) |
| Identifiers needed for a request (name, addresses, phones, emails) | Fill in broker requests | D1 `pii_payloads`, AES-GCM encrypted (planned) |
| Texas TDPSA requests: broker, date sent, deadline, status, notes | Track 45-day deadlines | Per-user D1 rows (confirmed design; not yet live) |
| Security audit log: user id, action, target, time, IP address, browser user-agent (IP and user-agent are personal data) | Security monitoring; kept 12 months | D1 `audit_log`, append-only (planned) |
| Rate-limit counters (hashed) | Stop abuse | KV `rl:*`, auto-expire (planned) |
| Browser cache | Offline use | Your browser's localStorage |
| Worker logs (Cloudflare Workers Logs, to be enabled): request time, method, path, status, errors; **no request bodies and no PII** (we do not log identifiers, emails, or form contents) | Debugging and security monitoring | Cloudflare Workers Logs; kept per Cloudflare's default retention (see data-retention.md) |

No analytics, advertising, or tracking scripts. We do not sell personal data, use it for targeted advertising, or profile you.

## 2. Processors
Cloudflare, Inc. (Workers, D1, KV, Pages); Apple iCloud Mail for the help@droptexas.com contact inbox. Your own email provider when you send a request from your mail app. Brokers receive only what is needed to process your request.

## 3. Retention
- Identifiers for a request: deleted 30 days after the broker confirms; never kept more than 90 days.
- Finished opt-out records: deleted 24 months after completion.
- Texas TDPSA request records: deleted 3 years after final status.
- Security audit log (including IP address and user-agent): kept 12 months, append-only; rows older than 12 months are removed only by an approved scheduled job.
- Worker logs: Cloudflare's default retention (currently 3 days on the Workers Free plan; 7 days from Dec 1, 2026).
- Inactive accounts get a warning email 30 days before deletion.
- Inactive accounts: deleted after 24 months without sign-in.
- Deleted account: all per-user data removed.
A daily automatic purge is approved but not yet live. See data-retention.md.

## 4. Security (planned controls)
Unique logins with required TOTP MFA, hashed passwords, encrypted MFA secrets and identifiers, rate limiting, CSRF protection, expiring sessions, HTTPS through Cloudflare. Built to SOC 2 standards. Not audited, not certified.

## 5. Your rights (incl. Texas Data Privacy and Security Act)
You may confirm and access your data, correct it, delete it, get a portable copy, and opt out of sale, targeted advertising, or profiling (we do none of these). Email the privacy contact. We verify the request is yours, respond within 45 days (one 45-day extension with notice), and explain any refusal and how to appeal. Appeals are answered within 60 days; you may then complain to the Texas Attorney General. DROP Texas has no legal counsel, and whether TDPSA formally applies to this free service hasn't been determined. We honor these rights regardless.

## 6. Children
Not for children under 13.

## 7. Changes
Material changes are posted here with a new effective date and emailed to account holders.
