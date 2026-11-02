CREATE TABLE signups (
  id TEXT PRIMARY KEY NOT NULL,
  received_at TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  texas_resident INTEGER NOT NULL,
  jurisdiction TEXT NOT NULL,
  non_texas_flag INTEGER NOT NULL,
  submitter TEXT NOT NULL,
  guardian_attestation INTEGER NOT NULL,
  child_json TEXT
);

CREATE INDEX signups_received_at ON signups (received_at);
