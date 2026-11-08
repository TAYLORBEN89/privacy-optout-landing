// Test helper: insert a users row the way the Worker does (blind index + ciphertext, no plaintext address).
import { userEmailFields } from '../src/userEmail.js';

export async function insertUserRow(env, {
  id, email, pwHash, totpSecretEnc = null, totpEnabled = 0, createdAt = 1,
  lastActiveAt = null, inactivityWarnedAt = null,
}) {
  const fields = await userEmailFields(env, id, email);
  await env.DB.prepare(
    `INSERT INTO users (id, email, email_hmac, email_enc, email_key_version, email_placeholder, pw_hash, totp_secret_enc, totp_enabled, created_at, last_active_at, inactivity_warned_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  ).bind(
    id, fields.stored, fields.hmac, fields.blob, fields.version, fields.placeholder,
    pwHash, totpSecretEnc, totpEnabled ? 1 : 0, createdAt, lastActiveAt, inactivityWarnedAt,
  ).run();
  return fields;
}
