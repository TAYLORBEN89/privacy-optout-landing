#!/usr/bin/env node
// SQL-safety check: fails if any D1 prepare()/exec() call builds SQL with
// template-literal interpolation (${...}) or string concatenation (+).
// Use bound parameters (?1, ?2 with .bind()) instead.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const roots = (process.argv.slice(2).length ? process.argv.slice(2) : ["worker/src", "src", "functions"]).filter(existsSync);
const exts = /\.(m?[jt]sx?|cjs)$/;
const skip = new Set(["node_modules", "dist", ".wrangler", "test", "tests"]);
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    if (skip.has(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (exts.test(e)) files.push(p);
  }
};
roots.forEach(walk);

// Extract the full argument of each prepare(/exec( call by paren matching.
function callArgs(src) {
  const out = [];
  const re = /\.(prepare|exec)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 1, q = null, tdepth = 0;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (q) {
        if (c === "\\") { i++; continue; }
        if (q === "`" && c === "$" && src[i + 1] === "{") { tdepth++; i++; continue; }
        if (q === "`" && c === "}" && tdepth > 0) { tdepth--; continue; }
        if (c === q && tdepth === 0) q = null;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") q = c;
      else if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    out.push({ idx: m.index, arg: src.slice(start, i - 1) });
  }
  return out;
}

const hits = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const { idx, arg } of callArgs(src)) {
    const stripped = arg.replace(/(['"])(?:\\.|(?!\1).)*\1/g, "''"); // drop plain string contents
    const interp = /`[^`]*\$\{/.test(arg);
    const concat = /\+/.test(stripped.replace(/`[^`]*`/g, "``"));
    const nonLiteral = !/^\s*(['"`])/.test(arg) && arg.trim() !== "";
    if (interp || concat) {
      const line = src.slice(0, idx).split("\n").length;
      hits.push(`${f}:${line}: ${interp ? "template interpolation" : "string concatenation"}: ${arg.trim().split("\n")[0].slice(0, 120)}`);
    } else if (nonLiteral) {
      const line = src.slice(0, idx).split("\n").length;
      console.warn(`note ${f}:${line}: SQL passed as a variable; verify it is built from constants: ${arg.trim().slice(0, 80)}`);
    }
  }
}
console.log(`Scanned ${files.length} file(s) in: ${roots.join(", ") || "(none found)"}`);
if (hits.length) {
  console.error(`SQL-safety check FAILED (${hits.length} hit(s)):\n` + hits.join("\n"));
  process.exit(1);
}
console.log("SQL-safety check passed.");
