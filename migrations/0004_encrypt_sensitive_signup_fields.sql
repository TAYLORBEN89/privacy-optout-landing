-- Date of birth and child details are now encrypted in the Worker (AES-GCM,
-- key in the SIGNUP_PII_KEY Worker secret) before they reach D1.
-- New rows write dob = '' and child_json = NULL; ciphertext goes to the _enc columns.
-- 0001-0003 are left unchanged because they may already be applied.
-- Follow-up (needs Ben's approval): backfill-encrypt or purge older plaintext rows,
-- then drop dob and child_json.
ALTER TABLE signups ADD COLUMN dob_enc TEXT;
ALTER TABLE signups ADD COLUMN child_enc TEXT;
