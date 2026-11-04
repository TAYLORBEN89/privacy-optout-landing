# DROP Texas: Broker Deletion List Specification (v1.0)

For data broker engineering teams. This describes the files we send you, how to match them against your
records, and how to send back results. It follows the California DROP model (11 CCR §7613 and the CPPA DROP
technical specification) so an existing DROP integration can be reused.

## 1. Identifiers and list types

We collect five consumer fields: first and last name, date of birth (DOB), ZIP code, phone, and email.
They are sent only as hashes, in three list types:

| List type | Hash is built from | Kind |
| --- | --- | --- |
| `email` | standardized email | single field |
| `phone` | standardized phone | single field |
| `ndz` | first name + last name + DOB + ZIP | composite |

Name, DOB and ZIP are never sent on their own. Each of them is easy to guess (see section 9 of the internal report).

## 2. Standardization

Apply these rules to your own records before hashing. If a required field is missing or can't be standardized, that
record can't match that list type.

| Field | Rule | Example (synthetic) |
| --- | --- | --- |
| First / last name (separate fields) | Lowercase. Fold accented Latin letters to ASCII (å→a, ö→o, ñ→n). Transliterate Greek and Cyrillic, and map special Latin letters (ß→ss, æ→ae, œ→oe, ø→o, ð→d, þ→th, ł→l, đ→d, ħ→h, ŋ→n, ı→i, ĳ→ij, ŀ→l), using the DROP Transliteration Mapping (see 2a). Remove spaces, hyphens, apostrophes, punctuation, symbols, and any other non-letter or non-digit characters. Compound names become one value. Chinese, Japanese, Korean, Arabic and Hebrew characters are left unchanged. | `Juan Pablo` → `juanpablo`; `O'Connor-López` → `oconnorlopez` |
| DOB | 8 digits, `YYYYMMDD`. Accepted inputs: `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYYMMDD`, and US `MM/DD/YYYY`. A date that ends with the year is always read as month/day/year (US order). | `01/12/1990` → `19900112` (January 12) |
| ZIP | Drop a ZIP+4 suffix (everything from the first hyphen), keep letters and digits only, lowercase, remove leading zeros, then take the first 5 characters. An empty value or one that is only zeros is not hashable. | `91790-3771` → `91790`; `M1B 1A1` → `m1b1a`; ` 00712345` → `71234`; ` 00300-9999` → `300` |
| Phone | Strip every non-digit, then keep the last 10 digits, or all digits if there are fewer than 10. A value with no digits is not hashable. | `+1(415)555-9317` → `4155559317`; `+354(123)4567` → `3541234567`; `765-4321` → `7654321` |
| Email | trim surrounding whitespace, lowercase. Other characters, including `.` and `+`, are kept. | ` Jane.Doe+TX@Example.COM ` → `jane.doe+tx@example.com` |

### 2a. Greek and Cyrillic transliteration

We use the official DROP Transliteration Mapping, character for character. Source: CPPA DROP Technical and API Reference Documentation v1.2.0 (last updated July 2026), "Working with the data" > DROP Transliteration Mapping, https://privacy.ca.gov/drop-for-data-brokers/technical-specifications/working-with-data/.

- Greek: α→a β→v γ→g δ→d ε→e ζ→z η→i θ→th ι→i κ→k λ→l μ→m ν→n ξ→x ο→o π→p ρ→r σ/ς→s τ→t υ→y φ→f χ→ch ψ→ps ω→o; the accented forms ά έ ί ή ύ ό ώ ϊ ΐ ϋ ΰ map to their base letter.
- Cyrillic: а→a б→b в→v г→g д→d е→e ё→yo ж→zh з→z и→i й→y к→k л→l м→m н→n о→o п→p р→r с→s т→t у→u ф→f х→kh ц→ts ч→ch ш→sh щ→shch ъ→(removed) ы→y ь→(removed) э→e ю→yu я→ya є→e і→i ї→i ґ→g ў→u.
- Characters the mapping doesn't list (for example Serbian/Macedonian ђ ј љ њ ћ џ ѕ ѓ ќ) are left unchanged.

Examples (synthetic): `Νίκος` → `nikos`, `Παπαδόπουλος` → `papadopoylos`, `Щербаков` → `shcherbakov`, `Мар'яна` → `maryana`.

## 3. Hashing

- Algorithm: SHA-256
- Input encoding: UTF-8
- Output: standard Base64 with `=` padding, always 44 characters

Example: `juanpablo` → `91hIbrbzNeqHs3o81O5yNrXUj7wDd2shvZ6THKi9qz8=`. This value matches the CPPA DROP published vector.

Reference command: `printf %s 'juanpablo' | openssl dgst -sha256 -binary | base64`

## 4. Composite keys (`ndz`)

1. Standardize and hash each of the four fields separately.
2. Concatenate the four Base64 strings in this order: **FirstName + LastName + DOB + ZIP**. Don't add separators.
3. Run SHA-256 over that 176-character string (UTF-8), then encode the result as Base64.

## 5. Test vectors

`samples/synthetic-test-vectors.csv` gives the raw input, standardized value and expected hash for each field, plus one
full composite. All of the data is fictional. Every vector was computed independently with openssl, and our test suite
checks that the engine reproduces them. Validate your implementation against this file before you process a live list.

## 6. List files

- Format: UTF-8 CSV, LF line endings, with the header row `Id,Hash`.
- `Id`: an opaque work-item id that is random and unique within the list. It carries no meaning and does not link to
  ids in other lists.
- `Hash`: the 44-character value described above.
- Rows are sorted by `Id` in ascending byte order.
- One file holds one list type for one broker.
- File name: `droptx_<broker_id>-<list_type>-v<version>_<YYYYMMDD>.csv`, for example
  `droptx_acme-data-email-v3_20261104.csv`.
- **Versioning:** each new list for a broker and list type gets the next version number. A published version is never
  changed.
- **Manifest:** a JSON file sent with each list. It contains `list_id`, `broker_id`, `list_type`, `version`, `created_at`,
  `response_due`, `row_count`, `file_name`, and `sha256` (the hex SHA-256 of the CSV bytes). Check the checksum before
  you process the file.

```
Id,Hash
AAA1example,7unXmzUnRdnshdyh+VVjfB/qr7kWSxUmH/beD4FXAJA=
```

## 7. Delivery

- **Primary method: secure download.** Lists are downloaded over HTTPS (TLS 1.2 or higher) with credentials issued to
  your organization alone. Credentials are separate for each broker, can be rotated, and only reach that broker's lists.
  Every download is logged. Credentials are bearer tokens shown once at issue and expire after 365 days. Endpoints:
  `GET /broker/v1/lists`, `GET /broker/v1/lists/{list_id}/manifest`, `GET /broker/v1/lists/{list_id}/file`,
  `POST /broker/v1/lists/{list_id}/link` (a signed download link valid for 5 minutes), and
  `POST /broker/v1/lists/{list_id}/status?version={n}` for returning statuses. Your broker id comes from your credential.
- **Optional alternative: SFTP (planned).** Will be available on request, with a per-broker key and a per-broker
  directory. It is not offered yet.
- Lists are never sent by email.

## 8. Response window and cadence

- A new list version is published **monthly**, on the 1st. An `Id` can stand for more than one of our requests when
  they share a hash; return one status for it.
- **You have 45 days** from `created_at` to return statuses for a list. The deadline is `response_due` in the manifest.
  A file received after that time is rejected and logged.

## 9. Returning statuses

Return one CSV for each list with the header row `Id,Status`. See `samples/status-response-template.csv`.

| Code | Meaning |
| --- | --- |
| 2 | Exempt: a match was found and all of the personal information is exempt |
| 3 | Deleted: a match was found and the non-exempt personal information was deleted |
| 4 | Opted out: several consumers share the identifier, and all of them were opted out of sale and sharing |
| 5 | Not found: no match after the full matching process |

Validation rules:

- **The whole file is rejected** if its header is wrong, the list or version is unknown, it doesn't match your broker
  id, or it arrives after `response_due`.
- **A single row is rejected** if it's malformed, its code is not 2, 3, 4 or 5, its `Id` isn't in that list, its `Id`
  appears twice in the file, or its `Id` already has a status.
- Every status is final and recorded once. You can send several partial files before the deadline.
- You get back an acceptance report with counts and the line numbers of rejected rows.

## 10. Security and retention

SOC 2-ready. Lists contain only hashes and opaque ids. Finished request records are kept for 24 months,
and Texas request records for 3 years, then deleted.
