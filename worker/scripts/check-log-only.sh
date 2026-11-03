#!/usr/bin/env bash
# Only src/log.js may call console.*; everything else logs through log()/logError() (allowlisted fields only).
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -rnE 'console\.(log|error|warn|info|debug)' src --include='*.js' | grep -v '^src/log.js:'; then
  echo "FAIL: console.* outside src/log.js" >&2; exit 1
fi
echo "OK: only src/log.js writes logs"
