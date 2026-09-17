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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidAccept(
  value: unknown,
): value is { amount: string; asset: string; payTo: string; network: string; scheme?: string } {
  return (
    isPlainObject(value) &&
    typeof value.amount === "string" &&
    typeof value.asset === "string" &&
    typeof value.payTo === "string" &&
    typeof value.network === "string"
  );
}

/**
 * Decodes the base64-encoded JSON carried in the `payment-required` header.
 *
 * When `preferredNetwork` is given and an accept for that network is present,
 * that one is returned instead of `accepts[0]` — a seller may offer several
 * networks, and the one actually paid is whichever the buyer is registered
 * for, not necessarily the first in the list. Hardened against a decoded
 * body that isn't the expected shape at all (null, a number, a string, or
 * `accepts` missing/not an array).
 */
export function decodeChallenge(header: string, preferredNetwork?: string): DecodedChallenge {
  let parsed: unknown;
  try {
    const json = Buffer.from(header, "base64").toString("utf-8");
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new Error("Could not decode payment-required header: invalid base64/JSON.", {
      cause,
    });
  }

  if (!isPlainObject(parsed)) {
    throw new Error("Decoded payment-required header is not a JSON object.");
  }

  const accepts = (parsed as RawPaymentRequired).accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    throw new Error("Decoded payment-required header has no accepted payment options.");
  }

  const preferred = preferredNetwork
    ? accepts.find((candidate) => isPlainObject(candidate) && candidate.network === preferredNetwork)
    : undefined;
  const accept = preferred ?? accepts[0];

  if (!isValidAccept(accept)) {
    throw new Error(
      "Decoded payment-required header's selected accept entry is missing required fields.",
    );
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
