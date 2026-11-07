// WebCrypto helpers: PBKDF2 password hashing, SHA-256, AES-GCM, constant-time compare.
const enc = new TextEncoder();
export const PBKDF2_ITERATIONS = 100000; // Cloudflare Workers' WebCrypto caps PBKDF2 at 100k iterations.

export const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
export const randomToken = (n = 32) =>
  b64(randomBytes(n)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function sha256Hex(str) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a, b) {
  const x = typeof a === 'string' ? enc.encode(a) : a;
  const y = typeof b === 'string' ? enc.encode(b) : b;
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = randomBytes(16);
  return `pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(await pbkdf2(password, salt, iterations))}`;
}

export async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2-sha256' || !iter || !salt || !hash) return false;
  const got = await pbkdf2(password, unb64(salt), Number(iter));
  return timingSafeEqual(got, unb64(hash));
}

// Fixed-format dummy hash so unknown-user logins do the same PBKDF2 work.
let dummy;
export async function dummyVerify(password) {
  dummy ??= await hashPassword('dummy-password-not-a-real-account');
  await verifyPassword(password, dummy);
  return false;
}

async function importAes(keyB64, name) {
  if (!keyB64) throw new Error(`${name} not configured`);
  const raw = unb64(keyB64);
  if (raw.length !== 32) throw new Error(`${name} must be 32 bytes (base64)`);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const aesKey = (env) => importAes(env.TOTP_ENC_KEY, 'TOTP_ENC_KEY');

// ---- PII encryption: separate key (PII_ENC_KEY), versioned, AAD binds ciphertext to its row. ----
// Rotation: set PII_ENC_KEY to the new key, bump PII_KEY_VERSION, and move the old key to
// PII_ENC_KEY_PREV / PII_PREV_KEY_VERSION until every row has been re-encrypted.
export const piiKeyVersion = (env) => Number(env.PII_KEY_VERSION || 1);
function piiKeyFor(env, version) {
  if (version === piiKeyVersion(env)) return importAes(env.PII_ENC_KEY, 'PII_ENC_KEY');
  if (env.PII_ENC_KEY_PREV && version === Number(env.PII_PREV_KEY_VERSION)) return importAes(env.PII_ENC_KEY_PREV, 'PII_ENC_KEY_PREV');
  throw new Error(`no PII key for version ${version}`);
}
export async function encryptPii(env, plain, aad) {
  const iv = randomBytes(12); // fresh random 96-bit IV per write
  const version = piiKeyVersion(env);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, await piiKeyFor(env, version), enc.encode(plain));
  return { blob: `${b64(iv)}.${b64(ct)}`, version };
}
export async function decryptPii(env, blob, version, aad) {
  const [iv, ct] = blob.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: enc.encode(aad) }, await piiKeyFor(env, version), unb64(ct));
  return new TextDecoder().decode(pt);
}
export async function encryptStr(env, plain) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), enc.encode(plain));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function decryptStr(env, blob) {
  const [iv, ct] = blob.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

// Account email (users.email). Lookup key is HMAC-SHA256 under EMAIL_HMAC_KEY, never the AES key and never
// the landing Worker's SIGNUP_PII_KEY. Ciphertext uses encryptPii (PII_ENC_KEY) with AAD user-email:<user id>.
export class EmailKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmailKeyError';
  }
}

export const PLACEHOLDER_EMAIL_SUFFIX = '@users.invalid';
export const userEmailAad = (userId) => `user-email:${userId}`;

// Same canonical form the old UNIQUE COLLATE NOCASE column enforced, plus the trim/length cap login already used.
export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().slice(0, 254);
}
export const isPlaceholderEmail = (normalized) => String(normalized || '').endsWith(PLACEHOLDER_EMAIL_SUFFIX);

// Base64 secrets: reuse is the decoded 32 bytes. atob accepts stripped padding and ASCII whitespace,
// so a text compare of the encoded strings misses a copy of the same key.
const HMAC_BYTE_SECRETS = ['PII_ENC_KEY', 'PII_ENC_KEY_PREV', 'TOTP_ENC_KEY', 'OAUTH_COOKIE_KEY', 'SIGNUP_PII_KEY'];
// Opaque tokens are not base64 keys. Exact string match is the reuse check for these two.
const HMAC_OPAQUE_SECRETS = ['API_TOKEN', 'ADMIN_BOOTSTRAP_TOKEN'];

function rawHmacKey(keyB64, name) {
  if (!keyB64) throw new EmailKeyError(`${name} not configured`);
  let raw;
  try { raw = unb64(keyB64); } catch { throw new EmailKeyError(`${name} must be 32 bytes (base64)`); }
  if (raw.length !== 32) throw new EmailKeyError(`${name} must be 32 bytes (base64)`);
  return raw;
}

function decodedSecret(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  try { return unb64(value); } catch { return null; }
}

// Blind index of the normalized address. Hex, so it cannot collide with an address (those contain "@").
export async function emailHmac(env, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new EmailKeyError('invalid email');
  const keyB64 = typeof env.EMAIL_HMAC_KEY === 'string' ? env.EMAIL_HMAC_KEY : '';
  for (const name of HMAC_OPAQUE_SECRETS) {
    const other = env[name];
    if (typeof other === 'string' && other.length > 0 && timingSafeEqual(keyB64, other)) {
      throw new EmailKeyError('EMAIL_HMAC_KEY must be a dedicated key');
    }
  }
  const raw = rawHmacKey(keyB64, 'EMAIL_HMAC_KEY');
  for (const name of HMAC_BYTE_SECRETS) {
    const otherRaw = decodedSecret(env[name]);
    if (otherRaw && timingSafeEqual(raw, otherRaw)) throw new EmailKeyError('EMAIL_HMAC_KEY must be a dedicated key');
  }
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`users.email\n${normalized}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
