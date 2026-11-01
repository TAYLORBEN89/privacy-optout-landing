#!/usr/bin/env bash
# Fails if any D1 query in src/ is built with string concatenation or template interpolation.
set -euo pipefail
# src/shared/ is pure validation shared with the frontend (no D1); RegExp.exec there is not SQL.
cd "$(dirname "$0")/.."
bad=0
# 1) prepare()/exec() whose first argument contains ${...} or a + operator
if rg -n --pcre2 -U -g '!src/shared/**' '\.(prepare|exec)\(\s*(`[^`]*\$\{|[^)]*?[\x27"`]\s*\+|[^)]*?\+\s*[\x27"`])' src; then bad=1; fi
# 2) prepare()/exec() called with a variable instead of a literal
if rg -n --pcre2 -g '!src/shared/**' '\.(prepare|exec)\(\s*[A-Za-z_$]' src; then bad=1; fi
# 3) .exec() is never allowed (no binding support)
if rg -n -g '!src/shared/**' '\.exec\(' src; then bad=1; fi
if [ "$bad" = 1 ]; then echo "FAIL: string-built SQL found"; exit 1; fi
echo "OK: all D1 queries in src/ use literal SQL with prepare().bind()"
