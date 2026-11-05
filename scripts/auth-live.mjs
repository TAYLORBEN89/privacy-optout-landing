/** npm run auth:live <url> — read-only: GET <url>/api/me with no cookie and no credentials must return 401. */
const base = process.argv[2];
if (!base) { console.error("usage: npm run auth:live <url>"); process.exit(2); }
const url = new URL("/api/me", base);
const res = await fetch(url, { method: "GET", redirect: "manual", credentials: "omit", headers: { accept: "application/json" } });
const ok = res.status === 401;
console.log(`GET ${url.origin}/api/me (no cookie) -> ${res.status} ${ok ? "auth live ok" : "auth live FAIL (expected 401)"}`);
process.exit(ok ? 0 : 1);
