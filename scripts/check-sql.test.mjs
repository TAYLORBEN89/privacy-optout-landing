// Self-test for scripts/check-sql.mjs. Run: node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSource } from "./check-sql.mjs";

const run = (src) => checkSource("fixture.js", src);
const errs = (src) => run(src).errors.length;

test("comment with apostrophe inside prepare() is not a false positive", () => {
  const src = `const r = await env.DB.prepare(
    // LIMIT 100: counted from each account's own warning + more
    /* block 'comment' + ${"${x}"} */
    'SELECT id FROM users WHERE id = ?1 LIMIT 100'
  ).bind(id).all();`;
  assert.equal(errs(src), 0);
  assert.equal(run(src).warnings.length, 0);
});

test("comment-like text inside strings is not treated as a comment", () => {
  assert.equal(errs(`db.prepare("SELECT '//' AS a, '/*' AS b WHERE x = ?1")`), 0);
  assert.equal(errs("db.prepare(`SELECT 'http://x' WHERE y = ?`) + 1"), 0);
});

test("safe literals and bind params pass", () => {
  assert.equal(errs(`db.prepare('SELECT * FROM t WHERE a = ?1 AND b = ?2').bind(a, b)`), 0);
  assert.equal(errs("db.prepare(`SELECT *\n FROM t\n WHERE a = ?`)"), 0);
  assert.equal(errs(`const Q = 'SELECT 1 WHERE a = ?'; db.prepare(Q)`), 0);
  assert.equal(errs(`const m = /a+b/.exec(s); RE.exec(x + y)`), 0); // RegExp#exec ignored
});

test("template interpolation and + concatenation fail", () => {
  assert.equal(errs("db.prepare(`SELECT * FROM t WHERE id = ${id}`)"), 1);
  assert.equal(errs(`db.prepare("SELECT * FROM t WHERE id = " + id)`), 1);
  assert.equal(errs("db.prepare(String.raw`SELECT ${id}`)"), 1);
  assert.equal(errs("env.DB.exec(`DROP TABLE ${t}`)"), 1);
});

test(".concat() fails", () => {
  assert.equal(errs(`db.prepare('SELECT 1 '.concat(id))`), 1);
});

test("SQL built in a variable fails", () => {
  assert.equal(errs("const q = `SELECT * FROM t WHERE e = ${e}`; db.prepare(q)"), 1);
  assert.equal(errs(`let q = "SELECT * FROM t WHERE e = " + e; db.prepare(q)`), 1);
  assert.equal(errs(`let q = 'SELECT 1'; q += " AND x = " + x; db.prepare(q)`), 1);
});

test("[...].join() fails, directly and via a variable", () => {
  assert.equal(errs(`db.prepare([ "SELECT", id ].join(" "))`), 1);
  assert.equal(errs(`const q = ["SELECT", id].join(" "); db.prepare(q)`), 1);
});

test("allowlist comment needs a reason and is reported", () => {
  const ok = run(`// sql-check: allow placeholders built from fixed "?"
db.prepare("SELECT * FROM t WHERE id IN (" + ids.map(() => "?").join(",") + ")")`);
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.allowed.length, 1);
  assert.match(ok.allowed[0], /placeholders built from fixed/);
  assert.equal(errs(`// sql-check: allow\ndb.prepare("SELECT " + x)`), 1);
});
