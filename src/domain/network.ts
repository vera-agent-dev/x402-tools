/**
 * Pure CAIP-2 network helpers. No I/O, no chain SDK dependency here so this
 * stays trivially testable; the adapter layer maps the resolved chain id to
 * an actual viem chain object.
 */

export const DEFAULT_NETWORK = "eip155:8453";
export const TESTNET_NETWORK = "eip155:84532";

const SUPPORTED_CHAIN_IDS = new Set([8453, 84532]);

/** Parses a CAIP-2 network id (e.g. "eip155:8453") into its numeric chain id. */
export function caip2ToChainId(network: string): number {
  const match = /^eip155:(\d+)$/.exec(network.trim());
  if (!match) {
    throw new Error(`Malformed CAIP-2 network id: "${network}"`);
  }

  const chainId = Number(match[1]);
  if (!SUPPORTED_CHAIN_IDS.has(chainId)) {
    throw new Error(
      `Unsupported network "${network}". Supported: ${DEFAULT_NETWORK} (Base) and ${TESTNET_NETWORK} (Base Sepolia).`,
    );
  }

  return chainId;
}
