// users.email: HMAC blind index for lookup, AES-GCM ciphertext at rest.
// D1 cannot compute either (the keys are Worker secrets), so existing plaintext rows are sealed here:
// on password lookup, on the inactivity warning pass, and by the daily backfill (at most 100 rows a run).
// The legacy `email` column stays NOT NULL UNIQUE (rebuilding `users` would cascade through sessions and the
// other child tables). After a row is sealed that column holds the blind index, not the address.
import { decryptPii, encryptPii, emailHmac, EmailKeyError, isPlaceholderEmail, normalizeEmail, userEmailAad } from './crypto.js';
import { log, logError } from './log.js';

export async function userEmailFields(env, userId, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new EmailKeyError('invalid email');
  const hmac = await emailHmac(env, normalized);
  const { blob, version } = await encryptPii(env, normalized, userEmailAad(userId));
  return {
    normalized,
    stored: hmac,
    hmac,
    blob,
    version,
    placeholder: isPlaceholderEmail(normalized) ? 1 : 0,
  };
}

export async function decryptUserEmail(env, row) {
  return decryptPii(env, row.email_enc, row.email_key_version, userEmailAad(row.id));
}

// Address when the caller needs it. Sealed rows decrypt. A not-yet-sealed row still has the address in `email`.
export async function readUserEmail(env, row) {
  if (!row) return null;
  if (row.email_enc) return decryptUserEmail(env, row);
  return normalizeEmail(row.email) || null;
}

// Rewrite one plaintext row. Returns false when there is nothing to seal or the blind index is already taken.
// Throws EmailKeyError (or the PII key error) before any write when a required key is missing.
export async function sealStoredEmail(env, userId, plaintext) {
  const normalized = normalizeEmail(plaintext);
  if (!normalized) return false;
  const fields = await userEmailFields(env, userId, normalized);
  try {
    const r = await env.DB.prepare(
      `UPDATE users SET email = ?1, email_hmac = ?2, email_enc = ?3, email_key_version = ?4, email_placeholder = ?5
       WHERE id = ?6 AND email_enc IS NULL`,
    ).bind(fields.stored, fields.hmac, fields.blob, fields.version, fields.placeholder, userId).run();
    return r.meta.changes === 1;
  } catch (e) {
    if (String(e?.message || '').includes('UNIQUE')) return false;
    throw e;
  }
}

// Password sign-in. HMAC lookup first. A leftover plaintext row matches only while email_enc is still null,
// and is sealed before the caller checks the password. A missing HMAC key is the same as "no such account"
// (the caller still runs the dummy password check); it never falls back to storing or searching plaintext.
export async function findUserByEmail(env, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  let hmac;
  try {
    hmac = await emailHmac(env, normalized);
  } catch (e) {
    if (e instanceof EmailKeyError) {
      logError('email_lookup', e, { job: 'login' });
      return null;
    }
    throw e;
  }
  const byIndex = await env.DB.prepare(
    'SELECT id, pw_hash, totp_enabled, email, email_enc, email_key_version, email_placeholder FROM users WHERE email_hmac = ?1',
  ).bind(hmac).first();
  if (byIndex) return byIndex;
  const legacy = await env.DB.prepare(
    'SELECT id, pw_hash, totp_enabled, email, email_enc, email_key_version, email_placeholder FROM users WHERE email = ?1 AND email_enc IS NULL',
  ).bind(normalized).first();
  if (!legacy || normalizeEmail(legacy.email) !== normalized) return null;
  try {
    await sealStoredEmail(env, legacy.id, legacy.email);
  } catch (e) {
    logError('email_backfill', e, { job: 'login' });
  }
  return legacy;
}

// One daily batch. Idempotent: sealed rows (email_enc set) are not selected. Stops on a key error so a
// misconfigured worker does not report success. A UNIQUE clash on one row is skipped and left for review.
export async function backfillUserEmails(env) {
  const rows = await env.DB.prepare(
    'SELECT id, email FROM users WHERE email_enc IS NULL LIMIT 100',
  ).all();
  let sealed = 0;
  let skipped = 0;
  for (const row of rows.results) {
    if (await sealStoredEmail(env, row.id, row.email)) sealed++;
    else skipped++;
  }
  log('user_email_backfill', { counts: { sealed, skipped } });
  return { sealed, skipped };
}
