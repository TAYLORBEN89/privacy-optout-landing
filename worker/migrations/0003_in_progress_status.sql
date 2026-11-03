-- 0003: add status 'in_progress' (actively processing) to optout_requests.
-- SQLite can't ALTER a CHECK constraint, so the table is rebuilt.
-- Safety: DROP TABLE on a parent with ON DELETE CASCADE children would delete confirmations/pii_payloads
-- (FK actions still fire even when checks are deferred), so the child rows are copied aside first and restored.
-- Columns, defaults, constraints and all indexes are recreated exactly; row ids are preserved.
PRAGMA defer_foreign_keys = on;

CREATE TABLE optout_requests_new (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_id     TEXT REFERENCES brokers(id),
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','submitted','in_progress','pending','confirmed','denied','reverify')),
  submitted_at  INTEGER,
  confirmed_at  INTEGER,
  next_reverify INTEGER,
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'optout' CHECK (kind IN ('optout','tx')),
  finished_at   INTEGER,
  legacy_key    TEXT,
  service_id    TEXT,
  deadline      INTEGER,
  sub_status    TEXT
);

INSERT INTO optout_requests_new
  (id, user_id, broker_id, status, submitted_at, confirmed_at, next_reverify, notes, created_at, updated_at,
   kind, finished_at, legacy_key, service_id, deadline, sub_status)
SELECT id, user_id, broker_id, status, submitted_at, confirmed_at, next_reverify, notes, created_at, updated_at,
   kind, finished_at, legacy_key, service_id, deadline, sub_status
FROM optout_requests;

CREATE TABLE _bk_confirmations AS SELECT * FROM confirmations;
CREATE TABLE _bk_pii_payloads AS SELECT * FROM pii_payloads;

DROP TABLE optout_requests;            -- cascades to confirmations / pii_payloads (restored below)
ALTER TABLE optout_requests_new RENAME TO optout_requests;

INSERT INTO confirmations (id, request_id, confirmation_no, channel, received_at)
  SELECT id, request_id, confirmation_no, channel, received_at FROM _bk_confirmations;
INSERT INTO pii_payloads (request_id, payload_enc, purge_after, key_version, created_at)
  SELECT request_id, payload_enc, purge_after, key_version, created_at FROM _bk_pii_payloads;
DROP TABLE _bk_confirmations;
DROP TABLE _bk_pii_payloads;

CREATE INDEX optout_status ON optout_requests(user_id, status, next_reverify);
CREATE UNIQUE INDEX optout_legacy ON optout_requests(legacy_key) WHERE legacy_key IS NOT NULL;
CREATE INDEX optout_retention ON optout_requests(kind, finished_at);
