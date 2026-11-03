-- Same schema as the accounts Worker's 0008_rate_limits.sql (PRs #22/#23).
-- Fixed windows: one row per (key, window_start). key = sha256(scope|ip); IPs are never stored raw.
-- Not applied. Apply only with Ben's approval.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT    NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  expires_at   INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_expires ON rate_limits (expires_at);
