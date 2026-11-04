-- 0013: broker delivery. Per-broker credentials (hash only), delivery roster, monthly run ledger, request-ref mapping
-- for deduplicated hashes, and the gated retention-purge path for the 0012 write-once tables.
-- Not applied remotely by this PR.

-- Brokers that are ready to receive lists. broker_id is the slug used in list ids (hashEngine BROKER_ID rule).
CREATE TABLE IF NOT EXISTS delivery_brokers (
  broker_id  TEXT PRIMARY KEY,
  list_types TEXT NOT NULL DEFAULT 'email,phone,ndz',   -- comma-separated subset of email,phone,ndz
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL
);

-- Per-broker credentials. Only HMAC-SHA256(BROKER_CRED_KEYS[key_kid], secret) is stored, never the secret.
-- Credential rotation = issue a new credential, then revoke the old one. Revocation sets revoked_at (never cleared).
-- Server-key rotation: the only other allowed UPDATE is a re-wrap of a live credential to a different key_kid
-- (new secret_hmac + key_kid, nothing else changes), done lazily after a successful verify under the old key.
CREATE TABLE IF NOT EXISTS broker_credentials (
  kid         TEXT PRIMARY KEY,
  broker_id   TEXT NOT NULL REFERENCES delivery_brokers(broker_id),
  secret_hmac TEXT NOT NULL,
  key_kid     TEXT NOT NULL,                            -- which BROKER_CRED_KEYS entry produced secret_hmac
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);
CREATE INDEX IF NOT EXISTS broker_credentials_broker ON broker_credentials(broker_id);
CREATE TRIGGER IF NOT EXISTS broker_credentials_no_unrevoke BEFORE UPDATE ON broker_credentials
WHEN OLD.revoked_at IS NOT NULL OR NEW.kid <> OLD.kid OR NEW.broker_id <> OLD.broker_id
  OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at
  OR NOT (
    -- revoke: sets revoked_at, key material unchanged
    (NEW.revoked_at IS NOT NULL AND NEW.secret_hmac = OLD.secret_hmac AND NEW.key_kid = OLD.key_kid)
    -- re-wrap: still live, moves to a different server key
    OR (NEW.revoked_at IS NULL AND NEW.key_kid <> OLD.key_kid AND length(NEW.secret_hmac) = 64)
  )
BEGIN SELECT RAISE(ABORT, 'broker_credentials: only revocation or key re-wrap is allowed'); END;
-- Key-exists guard: with recursive_triggers off (D1 default) INSERT OR REPLACE / REPLACE INTO would delete the old
-- row without firing the DELETE trigger and so un-revoke or re-key a kid. Any insert of an existing kid aborts.
CREATE TRIGGER IF NOT EXISTS broker_credentials_no_replace BEFORE INSERT ON broker_credentials
WHEN EXISTS (SELECT 1 FROM broker_credentials WHERE kid = NEW.kid)
BEGIN SELECT RAISE(ABORT, 'broker_credentials: kid exists; revoke and issue a new credential'); END;
CREATE TRIGGER IF NOT EXISTS broker_credentials_no_delete BEFORE DELETE ON broker_credentials
BEGIN SELECT RAISE(ABORT, 'broker_credentials: revoke, do not delete'); END;

-- Monthly scheduler ledger: one list per broker, type and month (period = YYYYMM). The PK makes re-runs idempotent.
CREATE TABLE IF NOT EXISTS broker_list_runs (
  broker_id TEXT NOT NULL,
  list_type TEXT NOT NULL,
  period    TEXT NOT NULL,
  list_id   TEXT NOT NULL REFERENCES broker_lists(list_id),
  PRIMARY KEY (broker_id, list_type, period)
);

-- Every opt-out request behind a list row. Two requests with the same hash share one Id (one row in the file);
-- each request keeps its own ref here, so the broker's status for that Id applies to all of them.
CREATE TABLE IF NOT EXISTS broker_list_refs (
  list_id     TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  request_ref TEXT NOT NULL,
  PRIMARY KEY (list_id, request_ref),
  FOREIGN KEY (list_id, item_id) REFERENCES broker_list_items(list_id, item_id)
);
CREATE INDEX IF NOT EXISTS broker_list_refs_ref ON broker_list_refs(request_ref);

-- ---- gated retention purge (24 months) ----
-- maintenance_gate accepts two gate names now: audit_expiry (cutoff >= 365 days old, unchanged) and broker_purge
-- (cutoff >= 730 days old, measured against the database clock, so a caller can't pass a future "now").
DROP TRIGGER IF EXISTS maintenance_gate_min_age;
CREATE TRIGGER maintenance_gate_min_age BEFORE INSERT ON maintenance_gate
WHEN NOT ((NEW.name = 'audit_expiry' AND NEW.cutoff <= unixepoch() - 365 * 86400)
       OR (NEW.name = 'broker_purge' AND NEW.cutoff <= unixepoch() - 730 * 86400))
BEGIN SELECT RAISE(ABORT, 'maintenance gate: cutoff too recent (audit_expiry 365 days, broker_purge 730 days) or unknown gate'); END;

-- DELETE guards: allowed only while the broker_purge gate is open AND the row is older than its cutoff.
-- "Age" counts from the finish point so the full 24 months runs after it: broker_status.received_at (answered);
-- items/refs/runs/lists from the list's close = created_at + 90 days (7776000 s: 45-day window + 45-day extension),
-- and never while the item still has a status; broker_hash_audit.at (so download and credential history is dropped
-- 24 months after each event).
DROP TRIGGER IF EXISTS broker_status_no_delete;
CREATE TRIGGER broker_status_no_delete BEFORE DELETE ON broker_status
WHEN NOT EXISTS (SELECT 1 FROM maintenance_gate WHERE name = 'broker_purge' AND OLD.received_at < cutoff)
BEGIN SELECT RAISE(ABORT, 'broker_status is write-once'); END;

DROP TRIGGER IF EXISTS broker_list_items_no_delete;
CREATE TRIGGER broker_list_items_no_delete BEFORE DELETE ON broker_list_items
WHEN NOT EXISTS (SELECT 1 FROM maintenance_gate g JOIN broker_lists l ON l.list_id = OLD.list_id
                 WHERE g.name = 'broker_purge' AND l.created_at + 7776000 < g.cutoff)
  OR EXISTS (SELECT 1 FROM broker_status s WHERE s.list_id = OLD.list_id AND s.item_id = OLD.item_id)
BEGIN SELECT RAISE(ABORT, 'broker_list_items is write-once'); END;

CREATE TRIGGER IF NOT EXISTS broker_list_refs_no_replace BEFORE INSERT ON broker_list_refs
WHEN EXISTS (SELECT 1 FROM broker_list_refs WHERE list_id = NEW.list_id AND request_ref = NEW.request_ref)
BEGIN SELECT RAISE(ABORT, 'broker_list_refs is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_list_refs_no_update BEFORE UPDATE ON broker_list_refs
BEGIN SELECT RAISE(ABORT, 'broker_list_refs is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_list_refs_no_delete BEFORE DELETE ON broker_list_refs
WHEN NOT EXISTS (SELECT 1 FROM maintenance_gate g JOIN broker_lists l ON l.list_id = OLD.list_id
                 WHERE g.name = 'broker_purge' AND l.created_at + 7776000 < g.cutoff)
  OR EXISTS (SELECT 1 FROM broker_status s WHERE s.list_id = OLD.list_id AND s.item_id = OLD.item_id)
BEGIN SELECT RAISE(ABORT, 'broker_list_refs is write-once'); END;

CREATE TRIGGER IF NOT EXISTS broker_list_runs_no_replace BEFORE INSERT ON broker_list_runs
WHEN EXISTS (SELECT 1 FROM broker_list_runs WHERE broker_id = NEW.broker_id AND list_type = NEW.list_type AND period = NEW.period)
BEGIN SELECT RAISE(ABORT, 'broker_list_runs is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_list_runs_no_update BEFORE UPDATE ON broker_list_runs
BEGIN SELECT RAISE(ABORT, 'broker_list_runs is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_list_runs_no_delete BEFORE DELETE ON broker_list_runs
WHEN NOT EXISTS (SELECT 1 FROM maintenance_gate g JOIN broker_lists l ON l.list_id = OLD.list_id
                 WHERE g.name = 'broker_purge' AND l.created_at + 7776000 < g.cutoff)
BEGIN SELECT RAISE(ABORT, 'broker_list_runs is write-once'); END;

DROP TRIGGER IF EXISTS broker_lists_no_delete;
CREATE TRIGGER broker_lists_no_delete BEFORE DELETE ON broker_lists
WHEN NOT EXISTS (SELECT 1 FROM maintenance_gate WHERE name = 'broker_purge' AND OLD.created_at + 7776000 < cutoff)
  OR EXISTS (SELECT 1 FROM broker_list_items i WHERE i.list_id = OLD.list_id)
  OR EXISTS (SELECT 1 FROM broker_list_runs r WHERE r.list_id = OLD.list_id)
BEGIN SELECT RAISE(ABORT, 'broker_lists is write-once'); END;

DROP TRIGGER IF EXISTS broker_hash_audit_no_delete;
CREATE TRIGGER broker_hash_audit_no_delete BEFORE DELETE ON broker_hash_audit
WHEN NOT EXISTS (SELECT 1 FROM maintenance_gate WHERE name = 'broker_purge' AND OLD.at < cutoff)
BEGIN SELECT RAISE(ABORT, 'broker_hash_audit is append-only'); END;
