-- 0014: users.email becomes an HMAC blind index plus encrypted address.
-- 0009 was reserved for email earlier and is still unused. 0012 and 0013 already exist on this lineage,
-- so this is the next number. Do not rebuild `users`: sessions, optout_requests, backup_codes, profiles,
-- user_identities and auth_handoffs reference it ON DELETE CASCADE (see 0007).
--
-- D1 cannot compute HMAC or AES-GCM (EMAIL_HMAC_KEY and PII_ENC_KEY are Worker secrets, not SQL).
-- Existing rows keep their plaintext `email` until the Worker seals them (password lookup, the inactivity
-- warning pass, and the daily user_email_backfill job, 100 rows at a time). New writes never store the address
-- in `email`: that column stays NOT NULL UNIQUE only as a slot, and after sealing it holds the same hex blind
-- index as email_hmac. A later migration may DROP COLUMN email once no row has email_enc IS NULL.
--
-- email_placeholder marks the synthetic "<user id>@users.invalid" social-only address (also sealed, not plaintext).
-- Unsealed placeholder rows are still recognizable by the address suffix until backfill sets the flag.

ALTER TABLE users ADD COLUMN email_hmac TEXT;
ALTER TABLE users ADD COLUMN email_enc TEXT;
ALTER TABLE users ADD COLUMN email_key_version INTEGER;
ALTER TABLE users ADD COLUMN email_placeholder INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX users_email_hmac ON users(email_hmac) WHERE email_hmac IS NOT NULL;
CREATE INDEX users_email_unsealed ON users(id) WHERE email_enc IS NULL;
