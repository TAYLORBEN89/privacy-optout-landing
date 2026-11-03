#!/usr/bin/env node
// SQL-safety check for D1 queries.
//
// Fails (exit 1) when SQL passed to .prepare()/.exec()/.raw() on a database
// object is built dynamically:
//   - template literal with ${...} interpolation
//   - string concatenation with +
//   - .concat(...) or [...].join(...)
//   - a same-file variable whose initializer does any of the above
// Literal SQL with bound parameters (?, ?1 + .bind()) passes.
//
// Comments are stripped and string/template contents are masked before
// scanning, so apostrophes or "+" inside comments or strings are ignored.
//
// Allowlist: a vetted dynamic query may be allowed with a comment on the call
// line or the line directly above it:
//     // sql-check: allow <reason>
// The reason is required. Every allowlisted spot is printed in the report.
//
// Usage: node scripts/check-sql.mjs [dir-or-file ...]
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const exts = /\.(m?[jt]sx?|cjs)$/;
const skip = new Set(["node_modules", "dist", ".wrangler", "test", "tests", "__fixtures__"]);
const ALLOW = /sql-check:\s*allow\s+\S/;

export function listFiles(roots) {
  const files = [];
  const walk = (p) => {
    if (statSync(p).isFile()) { if (exts.test(p)) files.push(p); return; }
    for (const e of readdirSync(p)) {
      if (skip.has(e)) continue;
      walk(join(p, e));
    }
  };
  roots.filter(existsSync).forEach(walk);
  return files;
}

// Returns src with comments blanked (newlines kept) and string/template text
// replaced by "x" (quotes and ${ } code kept). Same length as src.
export function mask(src) {
  const out = src.split("");
  const n = src.length;
  const blank = (a, b, ch) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = ch; };
  let i = 0;
  const stack = []; // template brace depth tracking: each entry = brace depth inside ${ }
  let prevSig = ""; // last significant code char, for regex detection
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const e = src.indexOf("\n", i); const end = e < 0 ? n : e; blank(i, end, " "); i = end; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; blank(i, end, " "); i = end; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      blank(i + 1, Math.min(j, n), "x"); i = j + 1; prevSig = c; continue;
    }
    if (c === "`" || (c === "}" && stack.length && stack[stack.length - 1] === 0)) {
      if (c === "}") stack.pop();
      let j = i + 1;
      while (j < n && src[j] !== "`" && !(src[j] === "$" && src[j + 1] === "{")) j += src[j] === "\\" ? 2 : 1;
      blank(i + 1, Math.min(j, n), "x");
      if (src[j] === "$") { stack.push(0); i = j + 2; prevSig = "{"; continue; }
      i = j + 1; prevSig = "`"; continue;
    }
    if (c === "/" && (prevSig === "" || /[(,=:[!&|?{};+\-*%<>~^]/.test(prevSig))) {
      // regex literal
      let j = i + 1, cls = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false;
        else if (src[j] === "/" && !cls) break;
        j++;
      }
      blank(i + 1, j, "x"); i = j + 1; prevSig = "/"; continue;
    }
    if (stack.length) { if (c === "{") stack[stack.length - 1]++; else if (c === "}") stack[stack.length - 1]--; }
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return out.join("");
}

function matchParen(m, open) {
  let depth = 1, i = open + 1;
  for (; i < m.length && depth; i++) { if (m[i] === "(") depth++; else if (m[i] === ")") depth--; }
  return i - 1;
}

// Classify a masked expression. Returns null (safe literal) or a reason.
function dynamicReason(expr) {
  if (/\$\{/.test(expr)) return "template interpolation";
  if (/(^|[^+])\+(?!\+)/.test(expr.replace(/\+\+|\+=/g, ""))) return "string concatenation";
  if (/\.concat\s*\(/.test(expr)) return ".concat()";
  if (/\.join\s*\(/.test(expr)) return "[...].join()";
  if (/\+=/.test(expr)) return "string concatenation (+=)";
  return null;
}
const isLiteral = (e) => /^(['"`])x*\1,?$/.test(e.replace(/\s+/g, ""));

export function checkSource(file, src) {
  const m = mask(src);
  const lines = src.split("\n");
  const lineOf = (idx) => src.slice(0, idx).split("\n").length;
  const errors = [], warnings = [], allowed = [];
  let calls = 0;
  const re = /([A-Za-z_$][\w$]*)\s*\??\.\s*(prepare|exec|raw)\s*\(/g;
  let r;
  while ((r = re.exec(m))) {
    const recv = r[1], method = r[2];
    // exec/raw are only SQL on a DB handle (skip RegExp#exec etc.)
    if (method !== "prepare" && !/db$/i.test(recv)) continue;
    calls++;
    const open = re.lastIndex - 1, close = matchParen(m, open);
    const arg = m.slice(open + 1, close);
    const line = lineOf(r.index);
    const snippet = src.slice(open + 1, close).trim().split("\n")[0].slice(0, 100);
    const report = (kind, msg) => {
      const text = `${file}:${line}: ${msg}: ${snippet}`;
      if (kind === "error" && (ALLOW.test(lines[line - 1] || "") || ALLOW.test(lines[line - 2] || ""))) {
        const why = ((lines[line - 1].match(/sql-check:\s*allow\s+(.*)/) || lines[line - 2].match(/sql-check:\s*allow\s+(.*)/))[1]).trim();
        allowed.push(`${text}  [allow: ${why}]`);
      } else (kind === "error" ? errors : warnings).push(text);
    };
    if (isLiteral(arg)) continue;
    const why = dynamicReason(arg);
    if (why) { report("error", why); continue; }
    const id = arg.trim().match(/^[A-Za-z_$][\w$]*$/);
    if (id) {
      const decl = new RegExp(`\\b(?:const|let|var)\\s+${id[0].replace(/\$/g, "\\$")}\\s*=`, "g");
      const d = decl.exec(m);
      if (d) {
        // initializer runs to the next ; at depth 0
        let i = decl.lastIndex, depth = 0;
        for (; i < m.length; i++) { const c = m[i]; if ("([{".includes(c)) depth++; else if (")]}".includes(c)) { if (!depth) break; depth--; } else if (c === ";" && !depth) break; }
        const init = m.slice(decl.lastIndex, i);
        // also catch later "name += ..." / "name = name + ..."
        const reassigned = new RegExp(`\\b${id[0].replace(/\$/g, "\\$")}\\s*(\\+=|=(?!=))`, "g");
        let extra = null, a; reassigned.lastIndex = i;
        while ((a = reassigned.exec(m))) { extra = "variable reassigned/appended after declaration"; break; }
        const w = dynamicReason(init) || extra;
        if (w) { report("error", `SQL variable '${id[0]}' built with ${w}`); continue; }
        if (isLiteral(init)) continue;
      }
    }
    report("warning", "SQL is not a literal; verify it is built only from constants");
  }
  return { calls, errors, warnings, allowed };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const roots = (args.length ? args : ["worker/src", "src", "functions"]).filter(existsSync);
  const files = listFiles(roots);
  const tot = { calls: 0, errors: [], warnings: [], allowed: [] };
  for (const f of files) {
    const res = checkSource(f, readFileSync(f, "utf8"));
    tot.calls += res.calls; tot.errors.push(...res.errors); tot.warnings.push(...res.warnings); tot.allowed.push(...res.allowed);
  }
  tot.warnings.forEach((w) => console.warn(`warning ${w}`));
  tot.allowed.forEach((w) => console.log(`allowlisted ${w}`));
  console.log(`Scanned ${files.length} file(s), ${tot.calls} SQL call(s) in: ${roots.join(", ") || "(none found)"}`);
  console.log(`errors: ${tot.errors.length}, warnings: ${tot.warnings.length}, allowlisted: ${tot.allowed.length}`);
  if (tot.errors.length) {
    console.error(`SQL-safety check FAILED:\n` + tot.errors.join("\n"));
    process.exit(1);
  }
  console.log("SQL-safety check passed.");
}
