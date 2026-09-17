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
 *
 * `maxPriceUsd` is enforced via the x402 client's own `setSpendControls`,
 * not just a local pre-check on the caller's side. That matters because a
 * seller can offer multiple `accepts` across networks/assets; only the
 * client (after filtering to the network/scheme actually registered here)
 * knows which one it is about to sign, so that's the only place the cap can
 * be checked against the amount that will really be paid.
 */
export function createPaidFetch(privateKey: string, network: string, maxPriceUsd: number): FetchLike {
  const chain = chainFor(network);
  const publicClient = createPublicClient({ chain, transport: http() });
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const signer = toClientEvmSigner(account, publicClient);

  const client = new x402Client().register(
    network as `${string}:${string}`,
    new ExactEvmScheme(signer),
  );
  client.setSpendControls({ maxAmountPerPayment: maxPriceUsd });

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
