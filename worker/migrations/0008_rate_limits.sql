-- 0008: strongly consistent rate-limit counters (replaces the eventually consistent KV "rl:*" limiter).
-- Fixed windows: one row per (key, window_start). key = sha256(scope|id); ids are never stored raw.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT    NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  expires_at   INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_expires ON rate_limits (expires_at);
