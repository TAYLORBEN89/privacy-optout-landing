-- One row per named broker after a signup is saved.
-- This Worker inserts status 'pending' only. confirmed and no_record are never written here.
-- error_code is a machine reason. It must not contain a field value.
CREATE TABLE optout_requests (
  id TEXT PRIMARY KEY NOT NULL,
  signup_id TEXT NOT NULL REFERENCES signups(id),
  broker_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'confirmed', 'denied')),
  sub_status TEXT,
  channel TEXT NOT NULL,
  opt_out_url TEXT NOT NULL,
  http_status INTEGER,
  error_code TEXT CHECK (
    error_code IS NULL OR error_code IN (
      'account',
      'captcha',
      'profile_url',
      'fcra_and_form',
      'interactive_form'
    )
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT
);

CREATE INDEX optout_requests_signup_id ON optout_requests (signup_id);

CREATE UNIQUE INDEX optout_requests_signup_broker ON optout_requests (signup_id, broker_id);
