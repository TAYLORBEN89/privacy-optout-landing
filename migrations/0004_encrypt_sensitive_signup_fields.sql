-- Signup PII is now encrypted in the Worker before it reaches D1.
-- pii_enc: AES-256-GCM JSON of name, date of birth, street address, city, ZIP,
--   email, phone and child details (key derived from the SIGNUP_PII_KEY Worker secret).
-- email_hmac: keyed HMAC-SHA-256 blind index of the lowercased email, for
--   equality lookups (deletion requests, dedupe) without storing the email.
-- New rows write '' (NOT NULL columns) or NULL into the legacy plaintext columns.
-- state, jurisdiction and flags stay plaintext (no direct identifier).
-- 0001-0003 are left unchanged because they may already be applied.
-- Before deploy (Ben's approval): backfill-encrypt or purge older plaintext rows.
-- See README "Signup PII encryption".
ALTER TABLE signups ADD COLUMN pii_enc TEXT;
ALTER TABLE signups ADD COLUMN email_hmac TEXT;
CREATE INDEX signups_email_hmac ON signups (email_hmac);
