-- 0010: inactive-account lifecycle. last_active_at is bumped on every new session (login/MFA/refresh).
-- Warning email at 23 months of inactivity, deletion at 24 months (only after a warning was sent).
ALTER TABLE users ADD COLUMN last_active_at INTEGER;
ALTER TABLE users ADD COLUMN inactivity_warned_at INTEGER;
UPDATE users SET last_active_at = created_at WHERE last_active_at IS NULL;
CREATE INDEX users_last_active ON users(last_active_at);
