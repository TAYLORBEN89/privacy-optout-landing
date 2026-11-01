#!/usr/bin/env bash
# Fails if the production config allows a localhost/loopback origin.
set -euo pipefail
cd "$(dirname "$0")/.."
line=$(grep -E '^ALLOWED_ORIGIN *=' wrangler.toml)
if echo "$line" | grep -qiE 'localhost|127\.0\.0\.1|http://'; then echo "FAIL: production ALLOWED_ORIGIN contains a dev origin"; exit 1; fi
echo "OK: production ALLOWED_ORIGIN is https-only, no localhost"
