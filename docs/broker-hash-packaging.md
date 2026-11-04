# How consumer opt-out data is compiled and packaged for brokers

This is an internal report for the owner and for broker technical staff. The exact wire format is in
[broker-spec.md](broker-spec.md). The code is `worker/src/hashEngine.js`, the tables are created by
`worker/migrations/0012_broker_hash_engine.sql`, and the tests are in `worker/test/hash-engine.test.js`.

## 1. What is collected and why

When a consumer submits an opt-out, we store their name, date of birth, ZIP, phone and email, encrypted at rest. These
are the identifiers brokers use to find that person in their own records. Brokers never receive the raw values. They
receive only one-way hashes of standardized values.

## 2. How a list is compiled

1. For a given broker and list type, select the Texas signup requests that have not yet been listed to that broker
   for that type (the monthly job, section 7).
2. Decrypt each record **in memory only**. This uses the existing PII key handling, which is unchanged.
3. Standardize each field (section 3), then hash it (section 4).
4. Drop records that are missing a required field. When two requests standardize to the same hash, the list carries
   that hash **once**, with one `Id`, and every request reference is kept: `broker_list_refs` maps the `Id` to all of
   them, so one returned status covers each of those requests.
5. Give each row a new random work-item `Id`. The mapping from `Id` to our internal request references stays on our
   side, in `broker_list_items` and `broker_list_refs`.
6. Write the CSV (`Id,Hash` only), sorted by `Id`, and compute its SHA-256 checksum.
7. Store the list and its manifest in `broker_lists`, and append a `list.generated` entry to the audit log. Large lists
   are written in chunks of 50 statements per D1 batch. The monthly run row and the `list.generated` row go in the
   final chunk; `list.generated` marks the list complete. Until it exists the list is never served, its requests
   don't count as listed, and it doesn't count toward a signup's finish. If a later chunk fails, the save fails
   loudly: a counts-only `list.save_failed` audit row is written, the monthly job reports an error, and the same
   requests are listed again on the next run under the next version number. The partial rows are inert and purged
   with other broker data.

Raw values are never written to a file, a log, or the audit table.

## 3. Standardization (example data, all synthetic)

| Field | Raw | Standardized |
| --- | --- | --- |
| first name | `Juan Pablo` | `juanpablo` |
| last name | `O'Connor-López` | `oconnorlopez` |
| last name | `Strauß` | `strauss` |
| DOB | `01/12/1990` or `1990-01-12` | `19900112` |
| first name | `Νίκος` | `nikos` |
| last name | `Щербаков` | `shcherbakov` |
| ZIP | `95811-6213` | `95811` |
| ZIP | `M1B 1A1` | `m1b1a` |
| ZIP | ` 00300-9999` | `300` (leading zeros removed) |
| phone | `+1 (987) 765-4321` | `9877654321` |
| phone | `765-4321` | `7654321` (fewer than 10 digits: all kept) |
| email | ` Jane.Doe+TX@Example.COM ` | `jane.doe+tx@example.com` |

Greek and Cyrillic names are transliterated with the official DROP Transliteration Mapping (CPPA DROP Technical and API Reference Documentation v1.2.0 (last updated July 2026), "Working with the data" > DROP Transliteration Mapping, https://privacy.ca.gov/drop-for-data-brokers/technical-specifications/working-with-data/); for example `Νίκος` → `nikos` and `Щербаков` → `shcherbakov`. Letters the mapping doesn't list are left unchanged. Names are lowercased, accents are folded to plain letters, and every space, hyphen, apostrophe and symbol is removed.
ZIPs follow the DROP spec: the +4 is dropped, letters and digits are kept, leading zeros are removed, and the first five characters are used. Phones keep the last 10 digits, or all digits when there are fewer. Dates of birth are parsed in US order: `MM/DD/YYYY`, so `01/12/1990` is January 12. ISO `YYYY-MM-DD` and `YYYYMMDD` are also accepted. Emails are only trimmed and lowercased. The `.` and `+` are kept, because removing them would change the address.

## 4. Hashing and composite keys

- Each standardized value is hashed with SHA-256 over UTF-8 and encoded as Base64. The result is always 44 characters.
- **Composite key (`ndz`):** hash the first name, last name, DOB and ZIP separately. Join the four hashes in that order
  with no separators, then hash the joined string again.
- Email and phone lists each use a single hash.

## 5. File format

Each list is a CSV with the header `Id,Hash`, plus a JSON manifest. The manifest fields are list id, broker, type,
version, created and due timestamps, row count, file name, and SHA-256 checksum. Files are named
`droptx_<broker>-<type>-v<version>_<YYYYMMDD>.csv`. Versions only go up, and a published version is never changed. A
published schema and synthetic test vectors are in `docs/samples/`.

## 6. Packaging and delivery

- **Primary method (built):** secure HTTPS download (`/broker/v1/...`), with credentials issued separately to each
  broker. A credential is a bearer token shown once at issue; only an HMAC-SHA256 of its secret is stored, and checks
  are constant-time. Credentials expire after 365 days and can be rotated (issue new, then revoke old). A broker can
  only reach its own lists (another broker's list returns the same 404 as an unknown one). Short-lived signed links
  (5 minutes) are available. Responses are `no-store`.
- **Server-key rotation (built):** the HMAC key is `BROKER_CRED_KEYS` (JSON `{kid: key}`) plus
  `BROKER_CRED_ACTIVE_KID`. Each credential stores the `key_kid` its HMAC was made with and is checked with that key,
  so the current and the previous key both work. An HMAC can't be re-wrapped without the secret, so after a successful
  check under an old key the credential is re-computed with the active key (`credential.rewrapped` in the audit log);
  0013 allows that update and revocation, nothing else. A revoked credential is permanent: no UPDATE of a revoked row
  is allowed (re-wrap included), and a BEFORE INSERT guard blocks REPLACE INTO / INSERT OR REPLACE on an existing kid
  (those would otherwise bypass the guards, since D1 runs with recursive_triggers off). Steps are in the README.
- **Every download is logged (built):** each download appends `list.downloaded` with the credential id and row count.
- **Optional (planned):** SFTP with a per-broker key, for brokers who ask for it. Not built yet.
- Lists are never sent by email.

## 7. Cadence and the 45-day window

New list versions are published monthly (built: a cron on the 1st at 09:00 UTC; rerunning in the same month builds
nothing new, and each version is the previous one plus one). Each list's `response_due` is 45 days
after it is created. Status files that arrive after that time are rejected and logged.

## 8. How brokers return statuses

Brokers return a CSV with the header `Id,Status`, using these codes:

| Code | Meaning |
| --- | --- |
| 2 | exempt |
| 3 | deleted |
| 4 | opted out |
| 5 | not found |

The validation rules:

- **The whole file is rejected** if the list is unknown, the version or broker doesn't match, the header is wrong, or the
  file is late.
- **A single row is rejected** if its code is unknown, its `Id` is unknown, its `Id` repeats within the file, or its
  `Id` already has a status.

Each status can be written once, and the database blocks any update to it. Each ingest appends a counts-only entry to
the audit log.

## 9. What a broker can and cannot learn from a hash

- **Can:** confirm that a consumer in its *own* records has opted out, by standardizing and hashing its own data the same
  way and looking for an equal value.
- **Cannot:** reverse a hash to get the original value, or learn anything about consumers it doesn't already have.
- **Caveat:** hashing doesn't hide values that are easy to guess. There are only about 40,000 ZIP codes and about 36,500
  plausible birth dates, so anyone could hash every possibility. That's why name, DOB and ZIP are only ever sent as a
  combined key and never alone. Email and phone have more possible values, but a broker that already holds a phone
  number can still confirm it. That confirmation is the intended use.
- Work-item `Id`s are random, and they differ from list to list, so they can't be used to link a consumer across lists.

## 10. Audit and retention

- All four broker tables (`broker_lists`, `broker_list_items`, `broker_status`, `broker_hash_audit`) are write-once. Database triggers block UPDATE, DELETE, and REPLACE INTO / INSERT OR REPLACE (a BEFORE INSERT guard aborts when the key already exists).
- `broker_hash_audit` records list generation, downloads, credential issue and revocation, status ingests and
  rejections, and purges, with counts and reasons only.
- Broker-data aging starts at the finish point, so the full 24 months runs after it: an answered item from when its
  status arrived; an unanswered item, its list and run row from the list's close (issue + 90 days: the 45-day window
  plus a possible 45-day extension). Audit rows age from their own time, so download and credential history
  (`list.downloaded`, `credential.*`) is dropped 24 months after each event.
- Retention purge (built, migration 0013): a daily job opens a `broker_purge` gate row, deletes, and closes the gate
  inside one D1 batch. The database refuses a gate cutoff younger than 730 days, and the DELETE guards allow only rows
  older than the cutoff while the gate is open. A dry run reports counts without deleting. Each run appends a
  counts-only `purge.completed` (or `purge.dry_run`) entry and a `maintenance_log` row.
- Retention: finished records are kept for 24 months. Texas request records are kept for 3 years.
- A signup is **finished** once every broker list it appears on has closed its response window including a possible
  45-day extension, i.e. the latest such list's issue date + 90 days (built: the daily `signup_finish` job). Its
  24-month clock starts then. A signup that is on no list yet is not finished.
- SOC 2-ready.
