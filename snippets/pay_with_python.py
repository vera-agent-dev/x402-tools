#!/usr/bin/env python3
"""Decode an x402 402 challenge and show what a manual payment needs.

Python has no first-party x402/EIP-3009 signing library at the time of
writing, so this snippet decodes the challenge (same base64 JSON format the
Node/curl snippets use) and prints the exact fields you would need to build
and sign an EIP-3009 `transferWithAuthorization` for USDC, rather than
pretending to sign one for you. For an actual automated payment, use the
Node snippet in this directory or the MCP server's X402_BUYER_PRIVATE_KEY.
"""
import base64
import json
import sys
import urllib.request

URL = sys.argv[1] if len(sys.argv) > 1 else (
    "https://x402-api.fly.dev/v1/package-trust?ecosystem=npm&name=left-pad"
)


def decode_challenge(header_value: str) -> dict:
    return json.loads(base64.b64decode(header_value))


def main() -> None:
    req = urllib.request.Request(URL, method="GET")
    try:
        urllib.request.urlopen(req)
        print("Request succeeded without payment (server may be in FREE_MODE).")
        return
    except urllib.error.HTTPError as err:
        if err.code != 402:
            raise
        header = err.headers.get("payment-required")
        if not header:
            print("Got 402 but no payment-required header.")
            return
        challenge = decode_challenge(header)
        accept = challenge["accepts"][0]
        print(f"scheme:  {accept['scheme']}")
        print(f"network: {accept['network']}")
        print(f"amount:  {accept['amount']} (raw units, 6 decimals for USDC)")
        print(f"asset:   {accept['asset']}")
        print(f"payTo:   {accept['payTo']}")
        print(
            "\nTo pay: sign an EIP-3009 transferWithAuthorization for the "
            "asset/amount/payTo above, then retry the request with an "
            "`X-PAYMENT` header carrying the signed authorization, per the "
            "x402 'exact' scheme. See snippets/pay-with-node.mjs for a "
            "working, automated version of this."
        )


if __name__ == "__main__":
    main()
