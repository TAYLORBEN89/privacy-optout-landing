#!/usr/bin/env bash
# Fails unless production ALLOWED_ORIGIN is exactly the droptexas.com origins (no localhost/loopback/http/pages.dev),
# and OAUTH_REDIRECT_URIS has no dev hosts.
set -euo pipefail
cd "$(dirname "$0")/.."
line=$(grep -E '^ALLOWED_ORIGIN *=' wrangler.toml)
if echo "$line" | grep -qiE 'localhost|127\.0\.0\.1|\[::1\]|http://|pages\.dev'; then echo "FAIL: production ALLOWED_ORIGIN contains a dev origin"; exit 1; fi
val=$(echo "$line" | sed -E 's/^[^"]*"([^"]*)".*/\1/')
if [ "$val" != "https://droptexas.com,https://www.droptexas.com" ]; then echo "FAIL: production ALLOWED_ORIGIN must be exactly https://droptexas.com,https://www.droptexas.com"; exit 1; fi
if grep -E '^OAUTH_REDIRECT_URIS *=' wrangler.toml | grep -qiE 'localhost|127\.0\.0\.1|http://'; then echo "FAIL: production OAUTH_REDIRECT_URIS contains a dev URI"; exit 1; fi
echo "OK: production ALLOWED_ORIGIN is https-only droptexas.com, no localhost"
