-- 0002: backup codes, encrypted profile, PII key versioning, record kinds + retention fields, legacy import ids.

CREATE TABLE backup_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE,            -- SHA-256 hex of normalized 80-bit code
  used_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX backup_codes_user ON backup_codes(user_id);

-- Profile identifiers used in request emails. Encrypted with PII_ENC_KEY (AAD = "profile:<user_id>").
CREATE TABLE profiles (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload_enc TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL
);

ALTER TABLE pii_payloads ADD COLUMN key_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pii_payloads ADD COLUMN created_at INTEGER;

-- kind: 'optout' (checklist) or 'tx' (Texas TDPSA broker request). finished_at drives 24-month / 3-year retention.
ALTER TABLE optout_requests ADD COLUMN kind TEXT NOT NULL DEFAULT 'optout' CHECK (kind IN ('optout','tx'));
ALTER TABLE optout_requests ADD COLUMN finished_at INTEGER;
ALTER TABLE optout_requests ADD COLUMN legacy_key TEXT;          -- e.g. "record:acxiom" / "txreq:..." from KV import
ALTER TABLE optout_requests ADD COLUMN service_id TEXT;          -- frontend SERVICES id / Texas broker id (non-PII)
ALTER TABLE optout_requests ADD COLUMN deadline INTEGER;         -- TX 45-day response deadline
ALTER TABLE optout_requests ADD COLUMN sub_status TEXT;          -- original detailed status (e.g. TX "appealed", "no_data")
CREATE UNIQUE INDEX optout_legacy ON optout_requests(legacy_key) WHERE legacy_key IS NOT NULL;
CREATE INDEX optout_retention ON optout_requests(kind, finished_at);
