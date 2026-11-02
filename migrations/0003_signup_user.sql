ALTER TABLE signups ADD COLUMN user_id TEXT;

CREATE INDEX signups_user_id ON signups (user_id);
