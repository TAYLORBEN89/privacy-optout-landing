-- 0012: broker hash engine. Per-broker deletion lists (hashes + opaque work-item ids only, never raw PII),
-- broker status responses, and an append-only audit log. 0009 is reserved for the email build.
CREATE TABLE IF NOT EXISTS broker_lists (
  list_id      TEXT PRIMARY KEY,           -- <broker_id>-<list_type>-v<version>
  broker_id    TEXT NOT NULL,
  list_type    TEXT NOT NULL CHECK (list_type IN ('email', 'phone', 'ndz')),
  version      INTEGER NOT NULL CHECK (version >= 1),
  created_at   INTEGER NOT NULL,
  response_due INTEGER NOT NULL,           -- created_at + 45 days
  row_count    INTEGER NOT NULL,
  sha256       TEXT NOT NULL,              -- SHA-256 (hex) of the CSV bytes as delivered
  UNIQUE (broker_id, list_type, version)
);

CREATE TABLE IF NOT EXISTS broker_list_items (
  list_id     TEXT NOT NULL REFERENCES broker_lists(list_id),
  item_id     TEXT NOT NULL,               -- random, per list; the only id a broker sees
  request_ref TEXT NOT NULL,               -- internal opaque reference to the opt-out request
  hash        TEXT NOT NULL,
  PRIMARY KEY (list_id, item_id)
);

CREATE TABLE IF NOT EXISTS broker_status (
  list_id     TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  status      INTEGER NOT NULL CHECK (status IN (2, 3, 4, 5)),
  received_at INTEGER NOT NULL,
  PRIMARY KEY (list_id, item_id),          -- one final status per item; duplicates are rejected
  FOREIGN KEY (list_id, item_id) REFERENCES broker_list_items(list_id, item_id)
);

CREATE TABLE IF NOT EXISTS broker_hash_audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        INTEGER NOT NULL,
  event     TEXT NOT NULL,                 -- list.generated | status.ingested | status.rejected
  broker_id TEXT,
  list_id   TEXT,
  detail    TEXT                           -- JSON counts/reasons only; never PII or hashes
);

CREATE TRIGGER IF NOT EXISTS broker_hash_audit_no_update BEFORE UPDATE ON broker_hash_audit
BEGIN SELECT RAISE(ABORT, 'broker_hash_audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS broker_hash_audit_no_delete BEFORE DELETE ON broker_hash_audit
BEGIN SELECT RAISE(ABORT, 'broker_hash_audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS broker_status_no_update BEFORE UPDATE ON broker_status
BEGIN SELECT RAISE(ABORT, 'broker_status is write-once'); END;

-- Immutability guards. REPLACE INTO / INSERT OR REPLACE resolve a key conflict by deleting the old row, and that delete
-- only fires DELETE triggers when recursive_triggers is on, so the UPDATE/DELETE triggers alone are not enough.
-- BEFORE INSERT guards abort whenever the key already exists, which blocks REPLACE regardless of that pragma.
-- All four tables are write-once: no UPDATE, no DELETE, no replace.
--
-- Retention purge (24 months for finished records), NOT built here: it will ship as its own reviewed migration/job
-- using a gate row like 0004's maintenance_gate (a 'broker_purge' gate with a minimum-age cutoff, opened and closed
-- inside the same D1 batch), and these DELETE guards will gain a matching WHEN NOT EXISTS (gate) clause.
CREATE TRIGGER IF NOT EXISTS broker_lists_no_replace BEFORE INSERT ON broker_lists
WHEN EXISTS (SELECT 1 FROM broker_lists WHERE list_id = NEW.list_id)
  OR EXISTS (SELECT 1 FROM broker_lists WHERE broker_id = NEW.broker_id AND list_type = NEW.list_type AND version = NEW.version)
BEGIN SELECT RAISE(ABORT, 'broker_lists is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_lists_no_update BEFORE UPDATE ON broker_lists
BEGIN SELECT RAISE(ABORT, 'broker_lists is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_lists_no_delete BEFORE DELETE ON broker_lists
BEGIN SELECT RAISE(ABORT, 'broker_lists is write-once'); END;

CREATE TRIGGER IF NOT EXISTS broker_list_items_no_replace BEFORE INSERT ON broker_list_items
WHEN EXISTS (SELECT 1 FROM broker_list_items WHERE list_id = NEW.list_id AND item_id = NEW.item_id)
BEGIN SELECT RAISE(ABORT, 'broker_list_items is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_list_items_no_update BEFORE UPDATE ON broker_list_items
BEGIN SELECT RAISE(ABORT, 'broker_list_items is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_list_items_no_delete BEFORE DELETE ON broker_list_items
BEGIN SELECT RAISE(ABORT, 'broker_list_items is write-once'); END;

CREATE TRIGGER IF NOT EXISTS broker_status_no_replace BEFORE INSERT ON broker_status
WHEN EXISTS (SELECT 1 FROM broker_status WHERE list_id = NEW.list_id AND item_id = NEW.item_id)
BEGIN SELECT RAISE(ABORT, 'broker_status is write-once'); END;
CREATE TRIGGER IF NOT EXISTS broker_status_no_delete BEFORE DELETE ON broker_status
BEGIN SELECT RAISE(ABORT, 'broker_status is write-once'); END;

CREATE TRIGGER IF NOT EXISTS broker_hash_audit_no_replace BEFORE INSERT ON broker_hash_audit
WHEN NEW.id IS NOT NULL AND EXISTS (SELECT 1 FROM broker_hash_audit WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'broker_hash_audit is append-only'); END;
