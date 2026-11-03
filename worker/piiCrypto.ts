/**
 * App-layer encryption for sensitive signup fields (date of birth, child details).
 * Key: 32 random bytes, base64, held in the SIGNUP_PII_KEY Worker secret.
 * Output: "v1.<iv b64>.<ciphertext b64>" (AES-256-GCM). Never log inputs or outputs.
 */
function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Config error for SIGNUP_PII_KEY. The name is logged; the value never is. */
export class SignupKeyError extends Error {
  constructor(code: "signup_key_missing" | "signup_key_invalid") {
    super(
      code === "signup_key_missing"
        ? "SIGNUP_PII_KEY is not set"
        : "SIGNUP_PII_KEY must be standard base64 of exactly 32 bytes (openssl rand -base64 32)",
    );
    this.name = code;
  }
}

export interface PiiKeys {
  /** AES-256-GCM key for field ciphertext. */
  enc: CryptoKey;
  /** HMAC-SHA-256 key for equality lookups (blind index). */
  index: CryptoKey;
}

/** Derives separate encryption and blind-index keys from SIGNUP_PII_KEY with HKDF-SHA-256. */
export async function importPiiKeys(secret: string | undefined): Promise<PiiKeys> {
  if (!secret || secret.trim().length === 0) throw new SignupKeyError("signup_key_missing");
  // Standard base64 (RFC 4648 with + / and = padding), as printed by `openssl rand -base64 32`.
  // Surrounding whitespace or a trailing newline is ignored. Hex and base64url are rejected.
  const text = secret.trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(text)) throw new SignupKeyError("signup_key_invalid");
  const raw = unb64(text);
  if (raw.byteLength !== 32) throw new SignupKeyError("signup_key_invalid");
  const master = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  const derive = (info: string, alg: AesKeyGenParams | HmacImportParams, usages: KeyUsage[]) =>
    crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(new ArrayBuffer(0)), info: new TextEncoder().encode(info) },
      master,
      alg,
      false,
      usages,
    );
  return {
    enc: await derive("droptexas:signups:enc:v1", { name: "AES-GCM", length: 256 }, ["encrypt", "decrypt"]),
    index: await derive("droptexas:signups:email-index:v1", { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign"]),
  };
}

/** Keyed blind index for an email: HMAC of the trimmed, lowercased address, hex. */
export async function emailIndex(keys: PiiKeys, email: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", keys.index, new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function encryptField(key: CryptoKey, plaintext: string, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, key, data);
  return `v1.${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

export async function decryptField(key: CryptoKey, token: string, aad: string): Promise<string> {
  const [version, iv, ct] = token.split(".");
  if (version !== "v1" || !iv || !ct) throw new Error("signup_cipher_invalid");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv), additionalData: new TextEncoder().encode(aad) },
    key,
    unb64(ct),
  );
  return new TextDecoder().decode(pt);
}
