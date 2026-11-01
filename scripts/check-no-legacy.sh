#!/usr/bin/env bash
# Production build (VITE_API_URL empty) must not contain the legacy KV dashboard (App.jsx / storage.js) or the "Legacy dashboard" link in Account.jsx.
set -euo pipefail
cd "$(dirname "$0")/.."
out=$(mktemp -d)
VITE_API_URL= npx vite build --outDir "$out" --emptyOutDir >/dev/null
if grep -rqE "VITE_API_URL not set|Forget key|privacy-dashboard:access-key|Legacy dashboard" "$out"; then
  echo "FAIL: legacy dashboard code found in the production build"; rm -rf "$out"; exit 1
fi
# Control: a dev build (VITE_API_URL set) must still include it, proving the markers are right.
VITE_API_URL=http://localhost:8787 npx vite build --outDir "$out" --emptyOutDir >/dev/null
if ! grep -rqE "VITE_API_URL not set|Forget key|privacy-dashboard:access-key|Legacy dashboard" "$out"; then
  echo "FAIL: control build lost the legacy dashboard (markers stale?)"; rm -rf "$out"; exit 1
fi
rm -rf "$out"
echo "OK: production build (VITE_API_URL empty) has no legacy dashboard"
