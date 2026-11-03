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
