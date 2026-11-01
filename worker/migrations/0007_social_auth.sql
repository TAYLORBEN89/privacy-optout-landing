-- 0007: social sign-in (Google, Apple, Microsoft), step-up auth, single-use OAuth state, audit IP/UA.
-- Numbered 0007 so it does not collide with 0004-0006 from other open PRs.
--
-- users.pw_hash stays NOT NULL on purpose: rebuilding `users` would require DROP TABLE on the parent of
-- sessions/optout_requests/backup_codes/profiles (all ON DELETE CASCADE), which is the riskiest kind of
-- production migration. Social-only users get the sentinel pw_hash '!' which verifyPassword() can never
-- accept (it is not a "pbkdf2-sha256$..." string), and users.email gets a synthetic unique
-- "<user_id>@users.invalid" placeholder. The real provider email lives (encrypted) in user_identities.

CREATE TABLE user_identities (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('google','apple','microsoft')),
  sub              TEXT NOT NULL,                 -- provider subject (Microsoft: "<tid>:<sub>")
  email            TEXT,                          -- AES-GCM(PII_ENC_KEY), AAD "identity:<provider>:<sub>"
  email_key_version INTEGER,
  email_verified   INTEGER NOT NULL DEFAULT 0,
  is_private_relay INTEGER NOT NULL DEFAULT 0,    -- Apple "Hide My Email" relay address
  created_at       INTEGER NOT NULL,
  last_login_at    INTEGER,
  UNIQUE (provider, sub)
);
CREATE INDEX user_identities_user ON user_identities(user_id);

-- Step-up re-auth timestamp and how the session was created ('password' | 'google' | 'apple' | 'microsoft').
ALTER TABLE sessions ADD COLUMN stepped_up_at INTEGER;
ALTER TABLE sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'password';

-- Display name for the account area. AES-GCM(PII_ENC_KEY), AAD "display:<user_id>".
ALTER TABLE users ADD COLUMN display_name_enc TEXT;
ALTER TABLE users ADD COLUMN display_name_key_version INTEGER;

-- Single-use OAuth state: the callback INSERTs sha256(state); a second use hits the PK and is refused.
CREATE TABLE oauth_states_used (
  state_hash TEXT PRIMARY KEY,
  used_at    INTEGER NOT NULL
);
CREATE INDEX oauth_states_used_at ON oauth_states_used(used_at);

-- Audit context (approved): client IP (CF-Connecting-IP) and User-Agent (<=512 chars). Stored only here,
-- never written to Workers Logs. Retention/append-only rules for audit_log are unchanged.
ALTER TABLE audit_log ADD COLUMN ip TEXT;
ALTER TABLE audit_log ADD COLUMN user_agent TEXT;
