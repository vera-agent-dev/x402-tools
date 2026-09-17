#!/usr/bin/env bash
# Manually inspect an x402 402 challenge with curl.
#
# curl cannot sign an on-chain payment for you, so this only shows the first
# half of the flow: the unpaid request and the decoded challenge headers.
# Use the Node or Python snippet in this directory to actually pay and retry.
set -euo pipefail

URL="${1:-https://x402-api.fly.dev/v1/package-trust?ecosystem=npm&name=left-pad}"

echo "GET $URL (unpaid)"
curl -sD - -o /tmp/x402-body.json "$URL" | grep -i "^payment-required:" || true
echo
echo "Decoded payment-required header (base64 JSON):"
curl -sD - -o /dev/null "$URL" \
  | grep -i "^payment-required:" \
  | cut -d' ' -f2- \
  | tr -d '\r' \
  | base64 -d \
  | python3 -m json.tool
