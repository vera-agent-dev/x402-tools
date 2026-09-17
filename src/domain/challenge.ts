/**
 * Pure decoding/formatting of an x402 "payment-required" challenge header.
 * No network calls here — the adapter layer fetches the header, this module
 * only interprets it, which keeps it trivial to unit test.
 */

// USDC (the only asset the seller API charges in) uses 6 decimals.
const USDC_DECIMALS = 6;

export interface DecodedChallenge {
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  amountRaw: string;
  amountUsd: number;
}

interface RawAccept {
  scheme?: string;
  network?: string;
  amount?: string;
  asset?: string;
  payTo?: string;
}

interface RawPaymentRequired {
  x402Version?: number;
  accepts?: RawAccept[];
}

/** Decodes the base64-encoded JSON carried in the `payment-required` header. */
export function decodeChallenge(header: string): DecodedChallenge {
  let parsed: RawPaymentRequired;
  try {
    const json = Buffer.from(header, "base64").toString("utf-8");
    parsed = JSON.parse(json) as RawPaymentRequired;
  } catch (cause) {
    throw new Error("Could not decode payment-required header: invalid base64/JSON.", {
      cause,
    });
  }

  const accept = parsed.accepts?.[0];
  if (!accept || !accept.amount || !accept.asset || !accept.payTo || !accept.network) {
    throw new Error("Decoded payment-required header has no accepted payment options.");
  }

  return {
    scheme: accept.scheme ?? "exact",
    network: accept.network,
    asset: accept.asset,
    payTo: accept.payTo,
    amountRaw: accept.amount,
    amountUsd: Number(accept.amount) / 10 ** USDC_DECIMALS,
  };
}

/** True when `amountUsd` is at or below `maxUsd`. */
export function isWithinSpendingGuard(amountUsd: number, maxUsd: number): boolean {
  return amountUsd <= maxUsd;
}

export interface FormatChallengeOptions {
  guardExceeded?: boolean;
  maxUsd?: number;
}

/** Human/agent-readable explanation of a challenge, for structured tool output. */
export function formatChallengeMessage(
  challenge: DecodedChallenge,
  options: FormatChallengeOptions = {},
): string {
  const amount = `$${challenge.amountUsd.toFixed(2)}`;
  const base = `This tool requires an x402 payment of ${amount} on network ${challenge.network} (asset ${challenge.asset}) to ${challenge.payTo}.`;

  if (options.guardExceeded) {
    return (
      `${base} This amount exceeds the configured spending guard ` +
      `(X402_MAX_PRICE_USD=${options.maxUsd ?? "?"}), so payment was refused. ` +
      `Raise X402_MAX_PRICE_USD if you want to allow it.`
    );
  }

  return (
    `${base} Set X402_BUYER_PRIVATE_KEY to a funded wallet's private key to pay ` +
    `automatically, or pay manually using the snippets in snippets/ and retry.`
  );
}
