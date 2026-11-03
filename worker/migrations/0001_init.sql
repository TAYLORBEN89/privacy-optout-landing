-- 0001_init: D1 schema for auth + opt-out tracking. All timestamps are unix epoch seconds (UTC).
-- Rate limiting is NOT in D1: it uses KV keys "rl:<scope>:<hash>" with a TTL equal to the window
-- (see src/ratelimit.js), so counters expire on their own and cost no D1 writes.

CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash          TEXT NOT NULL,              -- "pbkdf2-sha256$<iter>$<salt_b64>$<hash_b64>"
  totp_secret_enc  TEXT,                       -- AES-GCM(TOTP_ENC_KEY), "<iv_b64>.<ct_b64>"
  totp_pending_enc TEXT,                       -- secret during enrollment, before confirm
  totp_enabled     INTEGER NOT NULL DEFAULT 0,
  totp_last_step   INTEGER,                    -- last accepted 30s step; replay protection
  created_at       INTEGER NOT NULL
);

CREATE TABLE sessions (
  id_hash      TEXT PRIMARY KEY,               -- SHA-256 hex of the raw token; raw token never stored
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage        TEXT NOT NULL CHECK (stage IN ('preauth','session')),
  mfa          INTEGER NOT NULL DEFAULT 0,     -- 1 once TOTP verified for this session
  csrf         TEXT,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,               -- absolute cap
  rotated_from TEXT,
  revoked      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_exp ON sessions(expires_at);

CREATE TABLE brokers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  url           TEXT,
  method        TEXT,                          -- web_form | email | mail | phone
  category      TEXT,
  reverify_days INTEGER
);

CREATE TABLE optout_requests (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_id     TEXT REFERENCES brokers(id),
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','submitted','pending','confirmed','denied','reverify')),
  submitted_at  INTEGER,
  confirmed_at  INTEGER,
  next_reverify INTEGER,
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX optout_status ON optout_requests(user_id, status, next_reverify);

CREATE TABLE confirmations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id      TEXT NOT NULL REFERENCES optout_requests(id) ON DELETE CASCADE,
  confirmation_no TEXT NOT NULL,
  channel         TEXT,
  received_at     INTEGER NOT NULL
);
CREATE INDEX confirmations_req ON confirmations(request_id);

CREATE TABLE pii_payloads (
  request_id  TEXT PRIMARY KEY REFERENCES optout_requests(id) ON DELETE CASCADE,
  payload_enc TEXT NOT NULL,                   -- AES-GCM ciphertext
  purge_after INTEGER NOT NULL
);
CREATE INDEX pii_purge ON pii_payloads(purge_after);

CREATE TABLE audit_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action  TEXT NOT NULL,
  target  TEXT,
  at      INTEGER NOT NULL
);
CREATE INDEX audit_at ON audit_log(at);
