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

export async function importPiiKey(secret: string | undefined): Promise<CryptoKey> {
  if (!secret) throw new Error("signup_key_missing");
  const raw = unb64(secret.trim());
  if (raw.byteLength !== 32) throw new Error("signup_key_invalid");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
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
