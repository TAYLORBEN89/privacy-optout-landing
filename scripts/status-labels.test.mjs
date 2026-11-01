// Status 'denied' is stored as-is but shown to users as "Not completed" everywhere (run: npm run test:labels).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test("account UI labels 'denied' as \"Not completed\"", () => {
  assert.match(read('src/AccountArea.jsx'), /denied:\s*'Not completed'/);
});
test("Texas tab labels 'denied' as \"Not completed\"", () => {
  const s = read('src/TexasBrokers.jsx');
  assert.match(s, /\{\s*id:\s*'denied',\s*label:\s*'Not completed'\s*\}/);
  assert.doesNotMatch(s, /label:\s*'Denied'/);
});
