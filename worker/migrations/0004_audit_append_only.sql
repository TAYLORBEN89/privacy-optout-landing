-- 0004: audit_log is append-only with 12-month expiry. Kept minimal on purpose: the Cybersecurity Agent's
-- append-only + IP/UA change may add columns to audit_log; this migration only adds triggers and two small tables.
--
-- UPDATE on audit_log is always rejected. DELETE is rejected unless a row in maintenance_gate (written only by the
-- expiry job, inside the same D1 batch/transaction, then removed) allows it for rows older than the gate cutoff.
-- A gate cannot be opened for anything newer than 365 days.
-- Idempotent (IF NOT EXISTS) with the same object names as 0007_social_auth.sql, so it is safe before or after 0007.

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
