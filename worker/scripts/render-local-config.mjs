// Writes wrangler.local.toml (gitignored) from wrangler.toml, filling the real resource IDs from env vars.
// Usage: KV_RECORDS_ID=... D1_DATABASE_ID=... node scripts/render-local-config.mjs [--force]
// Account: export CLOUDFLARE_ACCOUNT_ID (never written to any file). IDs are not printed.
// WRANGLER_SRC / WRANGLER_OUT override the paths (used by the test).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const kv = process.env.KV_RECORDS_ID; const d1 = process.env.D1_DATABASE_ID;
if (!/^[0-9a-f]{32}$/.test(kv || '') || !/^[0-9a-f-]{36}$/.test(d1 || '')) {
  console.error('Set KV_RECORDS_ID (32 hex) and D1_DATABASE_ID (uuid) in the environment.'); process.exit(1);
}
const srcPath = process.env.WRANGLER_SRC || new URL('../wrangler.toml', import.meta.url);
const outPath = process.env.WRANGLER_OUT || new URL('../wrangler.local.toml', import.meta.url);
if (existsSync(outPath) && !process.argv.includes('--force')) {
  console.error('wrangler.local.toml already exists; pass --force to overwrite it.'); process.exit(1);
}
const KV_PH = 'id = "00000000000000000000000000000000"';
const D1_PH = 'database_id = "00000000-0000-0000-0000-000000000000"';
const src = readFileSync(srcPath, 'utf8');
if (!src.includes(KV_PH) || !src.includes(D1_PH)) { console.error('placeholders not found'); process.exit(1); }
// replaceAll: covers more than one binding of each kind.
const out = src.replaceAll(KV_PH, `id = "${kv}"`).replaceAll(D1_PH, `database_id = "${d1}"`);
writeFileSync(outPath, `# GENERATED, gitignored. Do not commit.\n${out}`, { mode: 0o600 });
console.log('wrote wrangler.local.toml');
