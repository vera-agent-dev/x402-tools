import { caip2ToChainId, DEFAULT_NETWORK } from "./network.js";

const DEFAULT_MAX_PRICE_USD = 0.1;
const DEFAULT_BASE_URL = "https://x402-api.fly.dev"; // TODO: confirm once deployed

/** Parses X402_MAX_PRICE_USD, defaulting when unset/empty and failing clearly otherwise. */
export function parseMaxPriceUsd(raw: string | undefined, fallback = DEFAULT_MAX_PRICE_USD): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `X402_MAX_PRICE_USD must be a positive number, got: "${raw}"`,
    );
  }

  return value;
}

export interface ParsedEnv {
  baseUrl: string;
  buyerPrivateKey?: string;
  network: string;
  maxPriceUsd: number;
}

/**
 * Validates the process environment at startup so misconfiguration fails
 * loudly and immediately, rather than surfacing as a confusing runtime error
 * on the first tool call.
 */
export function parseEnv(env: NodeJS.ProcessEnv): ParsedEnv {
  const baseUrl = env.X402_BASE_URL ?? DEFAULT_BASE_URL;
  try {
    new URL(baseUrl);
  } catch (cause) {
    throw new Error(`X402_BASE_URL is not a valid URL: "${baseUrl}"`, { cause });
  }

  const network = env.X402_NETWORK ?? DEFAULT_NETWORK;
  caip2ToChainId(network); // throws a clear error on an unsupported network

  const maxPriceUsd = parseMaxPriceUsd(env.X402_MAX_PRICE_USD);

  return {
    baseUrl,
    buyerPrivateKey: env.X402_BUYER_PRIVATE_KEY,
    network,
    maxPriceUsd,
  };
}
