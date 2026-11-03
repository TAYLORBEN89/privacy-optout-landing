/**
 * X-Internal-Auth signing for landing -> API service-binding calls.
 * Contract (agreed with the API Worker, PR #24):
 *   header    v1.<kid>.<ts>.<sig>
 *   canonical "v1\n" + kid + "\n" + METHOD + "\n" + pathname+search + "\n" + ts + "\n" + ip + "\n" + hex(sha256(body))
 *   sig       base64url (no padding) of HMAC-SHA256(keys[kid], canonical)
 * Keys: INTERNAL_PROXY_KEYS secret = JSON {kid: standardBase64Key}, each >= 32 bytes.
 * INTERNAL_PROXY_ACTIVE_KID (plain var) selects the signing key. Never log keys or signatures.
 */

export const KID_RE = /^[a-z0-9]{1,16}$/;

export class ProxyKeyError extends Error {
  constructor(code: string) {
    super(code);
    this.name = code;
  }
}

export interface ProxySigner {
  kid: string;
  key: CryptoKey;
}

function decodeStdBase64(text: string): Uint8Array<ArrayBuffer> | null {
  if (text.length === 0 || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  try {
    const raw = atob(text);
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Validates INTERNAL_PROXY_KEYS and INTERNAL_PROXY_ACTIVE_KID. Throws ProxyKeyError
 * (code only, no values) on bad JSON, bad kid format, missing active kid, a key under
 * 32 bytes, or a key equal to SIGNUP_PII_KEY.
 */
export async function loadProxySigner(
  keysJson: string | undefined,
  activeKid: string | undefined,
  signupPiiKey?: string,
): Promise<ProxySigner> {
  if (!keysJson) throw new ProxyKeyError("proxy_keys_missing");
  let parsed: unknown;
  try {
    parsed = JSON.parse(keysJson);
  } catch {
    throw new ProxyKeyError("proxy_keys_invalid_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ProxyKeyError("proxy_keys_invalid_json");
  const map = parsed as Record<string, unknown>;
  const entries = Object.entries(map);
  if (entries.length === 0) throw new ProxyKeyError("proxy_keys_missing");
  for (const [kid, value] of entries) {
    if (!KID_RE.test(kid)) throw new ProxyKeyError("proxy_kid_invalid");
    if (typeof value !== "string") throw new ProxyKeyError("proxy_key_invalid");
    const raw = decodeStdBase64(value.trim());
    if (!raw || raw.byteLength < 32) throw new ProxyKeyError("proxy_key_invalid");
    if (signupPiiKey && value.trim() === signupPiiKey.trim()) throw new ProxyKeyError("proxy_key_reused");
  }
  const kid = (activeKid ?? "").trim();
  if (!KID_RE.test(kid)) throw new ProxyKeyError("proxy_active_kid_invalid");
  const value = map[kid];
  if (typeof value !== "string") throw new ProxyKeyError("proxy_active_kid_missing");
  const raw = decodeStdBase64(value.trim())!;
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return { kid, key };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The ONE place the canonical string is built. Change here only, in step with the API Worker. */
export function canonicalString(parts: {
  kid: string;
  method: string;
  pathAndSearch: string;
  ts: number;
  ip: string;
  bodySha256Hex: string;
}): string {
  return ["v1", parts.kid, parts.method.toUpperCase(), parts.pathAndSearch, String(parts.ts), parts.ip, parts.bodySha256Hex].join("\n");
}

function base64urlNoPad(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function internalAuthHeader(
  signer: ProxySigner,
  request: { method: string; pathAndSearch: string; ip: string; body: Uint8Array },
  ts: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const canonical = canonicalString({
    kid: signer.kid,
    method: request.method,
    pathAndSearch: request.pathAndSearch,
    ts,
    ip: request.ip,
    bodySha256Hex: await sha256Hex(request.body),
  });
  const mac = await crypto.subtle.sign("HMAC", signer.key, new TextEncoder().encode(canonical));
  return `v1.${signer.kid}.${ts}.${base64urlNoPad(new Uint8Array(mac))}`;
}
