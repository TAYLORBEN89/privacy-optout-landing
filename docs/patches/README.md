# Follow-up patches (not applied here)

## landing-signup-pii-backfill.patch
Applies to the landing Worker tree (`sec/explore-layout-hardening`, PR #25, at f28dcae): `git apply docs/patches/landing-signup-pii-backfill.patch`.
The pre-0004 plaintext row is in the landing Worker's `signups` table and the crypto it must reuse (`worker/piiCrypto.ts`, `SIGNUP_PII_KEY`) only exists there, so the script can't live in this API Worker.

- `worker/backfillSignupPii.ts`: rows still holding plaintext (any legacy PII column non-empty) get `pii_enc` (same `v: 1` shape and AAD `signups:<id>:pii` as `saveSignup`) and `email_hmac`. The row is read back and decrypted, and only a matching round-trip scrubs the plaintext columns to `''`/NULL. Rows are never deleted. Idempotent: a crash after encrypting is verified and scrubbed on re-run. Apply mode records a D1 Time Travel bookmark before the first write and throws unless the plaintext count is 0 afterwards. Prepared statements only, and the output is counts plus the bookmark.
- `scripts/backfill-signup-pii.ts`: CLI over the D1 REST `/query` API (parameterized). **Dry run by default**; `--apply` writes. Env: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `SIGNUP_PII_KEY` (placeholders). Not run against prod: that needs Ben's approval.
- `tests/backfillSignupPii.test.ts`: 6 tests on real migrations (node:sqlite). Landing suite: 165/165 with the patch applied.
