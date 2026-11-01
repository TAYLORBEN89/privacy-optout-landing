import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const script = new URL('./render-local-config.mjs', import.meta.url).pathname;
const KV = 'a'.repeat(32), D1 = '11111111-2222-3333-4444-555555555555';
function run(env, args = []) {
  return spawnSync(process.execPath, [script, ...args], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
}
function fixture(body) {
  const d = mkdtempSync(join(tmpdir(), 'rlc-')); const src = join(d, 'w.toml');
  writeFileSync(src, body); return { src, out: join(d, 'out.toml') };
}
const GOOD = 'id = "00000000000000000000000000000000"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\n';
test('fails without IDs', () => { const f = fixture(GOOD); assert.notStrictEqual(run({ WRANGLER_SRC: f.src, WRANGLER_OUT: f.out }).status, 0); });
test('fails when a placeholder is missing', () => {
  const f = fixture('id = "00000000000000000000000000000000"\n');
  const r = run({ KV_RECORDS_ID: KV, D1_DATABASE_ID: D1, WRANGLER_SRC: f.src, WRANGLER_OUT: f.out });
  assert.notStrictEqual(r.status, 0);
});
test('writes 0600 file, does not print IDs, refuses overwrite without --force', () => {
  const f = fixture(GOOD); const env = { KV_RECORDS_ID: KV, D1_DATABASE_ID: D1, WRANGLER_SRC: f.src, WRANGLER_OUT: f.out };
  const r = run(env); assert.strictEqual(r.status, 0);
  assert.ok(!r.stdout.includes(KV) && !r.stdout.includes(D1));
  const out = readFileSync(f.out, 'utf8'); assert.ok(out.includes(KV) && out.includes(D1));
  assert.strictEqual(statSync(f.out).mode & 0o777, 0o600);
  assert.notStrictEqual(run(env).status, 0);
  assert.strictEqual(run(env, ['--force']).status, 0);
});
