# How consumer opt-out data is compiled and packaged for brokers

This is an internal report for the owner and for broker technical staff. The exact wire format is in
[broker-spec.md](broker-spec.md). The code is `worker/src/hashEngine.js`, the tables are created by
`worker/migrations/0012_broker_hash_engine.sql`, and the tests are in `worker/test/hash-engine.test.js`.

## 1. What is collected and why

When a consumer submits an opt-out, we store their name, date of birth, ZIP, phone and email, encrypted at rest. These
are the identifiers brokers use to find that person in their own records. Brokers never receive the raw values. They
receive only one-way hashes of standardized values.

## 2. How a list is compiled

1. For a given broker and list type, select the open opt-out requests.
2. Decrypt each record **in memory only**. This uses the existing PII key handling, which is unchanged.
3. Standardize each field (section 3), then hash it (section 4).
4. Drop records that are missing a required field, and duplicate hashes.
5. Give each row a new random work-item `Id`. The mapping from `Id` to our internal request reference stays on our side,
   in `broker_list_items`.
6. Write the CSV (`Id,Hash` only), sorted by `Id`, and compute its SHA-256 checksum.
7. Store the list and its manifest in `broker_lists`, and append a `list.generated` entry to the audit log.

Raw values are never written to a file, a log, or the audit table.

## 3. Standardization (example data, all synthetic)

| Field | Raw | Standardized |
| --- | --- | --- |
| first name | `Juan Pablo` | `juanpablo` |
| last name | `O'Connor-López` | `oconnorlopez` |
| last name | `Strauß` | `strauss` |
| DOB | `01/12/1990` or `1990-01-12` | `19900112` |
| ZIP | `95811-6213` | `95811` |
| phone | `+1 (987) 765-4321` | `9877654321` |
| email | ` Jane.Doe+TX@Example.COM ` | `jane.doe+tx@example.com` |

Names are lowercased, accents are folded to plain letters, and every space, hyphen, apostrophe and symbol is removed.
Emails are only trimmed and lowercased. The `.` and `+` are kept, because removing them would change the address.

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

- **Primary method:** secure HTTPS download, with credentials issued separately to each broker. A broker can only
  reach its own lists, and every download is logged.
- **Optional:** SFTP with a per-broker key, for brokers who ask for it.
- Lists are never sent by email.

## 7. Cadence and the 45-day window

New list versions are published on a regular cadence. The default is monthly. Each list's `response_due` is 45 days
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

- `broker_hash_audit` is append-only, and database triggers block UPDATE and DELETE on it. It records list generation,
  status ingests and rejections, with counts and reasons only.
- Retention: finished records are kept for 24 months. Texas request records are kept for 3 years.
- Built to SOC 2 standards.
