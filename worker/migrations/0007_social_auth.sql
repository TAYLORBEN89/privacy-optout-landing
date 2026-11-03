-- 0007: social sign-in (Google, Microsoft), step-up auth, single-use OAuth state, audit IP/UA.
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
  provider         TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  sub              TEXT NOT NULL,                 -- provider subject (Microsoft: "<tid>:<sub>")
  email            TEXT,                          -- AES-GCM(PII_ENC_KEY), AAD "identity:<provider>:<sub>"
  email_key_version INTEGER,
  email_verified   INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  last_login_at    INTEGER,
  UNIQUE (provider, sub)
);
CREATE INDEX user_identities_user ON user_identities(user_id);

-- Step-up re-auth timestamp and how the session was created ('password' | 'google' | 'microsoft').
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

-- Sign-in handoff from accounts.droptexas.com to droptexas.com. Only the SHA-256 of the random code is stored.
-- Single use (used_at), 60 s (expires_at), bound to user, intent, return_to and (step-up/link) the apex session hash.
CREATE TABLE auth_handoffs (
  code_hash    TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent       TEXT NOT NULL CHECK (intent IN ('login','stepup','link')),
  auth_method  TEXT NOT NULL CHECK (auth_method IN ('google','microsoft')),
  session_hash TEXT,
  -- sha256 of the apex __Host-login cookie; /api/auth/complete requires the same browser (login-CSRF defence).
  browser_hash TEXT NOT NULL,
  return_to    TEXT NOT NULL,
  auth_at      INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  used_at      INTEGER,
  -- intent='link' only: identity staged at the callback, inserted by /api/auth/complete after the session matches.
  link_sub               TEXT,
  link_email             TEXT,   -- AES-GCM(PII_ENC_KEY), AAD "identity:<provider>:<sub>"
  link_email_key_version INTEGER,
  link_email_verified    INTEGER
);

-- Audit context (approved): client IP (CF-Connecting-IP) and User-Agent (<=512 chars). Stored only here,
-- never written to Workers Logs. Unauthenticated auth.fail rows keep the IP but store a NULL User-Agent.
ALTER TABLE audit_log ADD COLUMN ip TEXT;
ALTER TABLE audit_log ADD COLUMN user_agent TEXT;

-- audit_log is append-only (12-month retention). Same objects and names as 0004_audit_append_only.sql (PR #3),
-- created with IF NOT EXISTS so this is a no-op when 0004 has already run. UPDATE is always rejected; DELETE only
-- passes while the expiry job (expireAudit) holds the maintenance_gate row inside its own D1 batch, and the gate
-- cannot be opened for rows newer than 365 days.
-- NOTE for merge order: if 0007 is applied BEFORE 0004, 0004's plain CREATE TABLE/TRIGGER statements would fail;
-- 0004 should then use IF NOT EXISTS as well (flagged in the PR).
CREATE TABLE IF NOT EXISTS maintenance_gate (
  name   TEXT PRIMARY KEY,
  cutoff INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS maintenance_gate_min_age BEFORE INSERT ON maintenance_gate
WHEN NEW.name <> 'audit_expiry' OR NEW.cutoff > unixepoch() - 365 * 86400
BEGIN SELECT RAISE(ABORT, 'audit expiry gate: cutoff must be at least 365 days old'); END;

CREATE TABLE IF NOT EXISTS maintenance_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  job     TEXT NOT NULL,
  ran_at  INTEGER NOT NULL,
  cutoff  INTEGER,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
WHEN NOT EXISTS (SELECT 1 FROM maintenance_gate WHERE name = 'audit_expiry' AND OLD.at < cutoff)
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TRIGGER IF NOT EXISTS maintenance_log_no_update BEFORE UPDATE ON maintenance_log
BEGIN SELECT RAISE(ABORT, 'maintenance_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS maintenance_log_no_delete BEFORE DELETE ON maintenance_log
BEGIN SELECT RAISE(ABORT, 'maintenance_log is append-only'); END;
