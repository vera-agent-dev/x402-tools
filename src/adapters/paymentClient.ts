import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { caip2ToChainId } from "../domain/network.js";
import type { FetchLike } from "./apiClient.js";

export interface Settlement {
  success: boolean;
  transaction: string | null;
  network: string;
  payer: string;
}

function chainFor(network: string) {
  const chainId = caip2ToChainId(network);
  return chainId === base.id ? base : baseSepolia;
}

/**
 * Wraps `fetch` so any 402 it hits is paid automatically on-chain, using the
 * exact same x402/fetch + x402/evm + viem shape proven in x402-api's
 * scripts/paid-call.mjs buyer script.
 */
export function createPaidFetch(privateKey: string, network: string): FetchLike {
  const chain = chainFor(network);
  const publicClient = createPublicClient({ chain, transport: http() });
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const signer = toClientEvmSigner(account, publicClient);

  const client = new x402Client().register(
    network as `${string}:${string}`,
    new ExactEvmScheme(signer),
  );
  return wrapFetchWithPayment(fetch, client) as FetchLike;
}

/** Decodes the settlement info from a paid response, or null if unpaid. */
export function decodeSettlement(response: Response): Settlement | null {
  const header =
    response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
  if (!header) return null;

  const decoded = decodePaymentResponseHeader(header) as {
    success: boolean;
    transaction: string | null;
    network: string;
    payer: string;
  };

  return {
    success: decoded.success,
    transaction: decoded.transaction,
    network: decoded.network,
    payer: decoded.payer,
  };
}
