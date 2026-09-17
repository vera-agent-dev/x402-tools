import { fetchProduct, type FetchLike } from "../adapters/apiClient.js";
import { createPaidFetch, decodeSettlement, type Settlement } from "../adapters/paymentClient.js";
import {
  decodeChallenge,
  formatChallengeMessage,
  isWithinSpendingGuard,
} from "../domain/challenge.js";
import type { CatalogEntry } from "../domain/catalog.js";

export interface ToolTextResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface PaidToolConfig {
  baseUrl: string;
  buyerPrivateKey?: string;
  network: string;
  maxPriceUsd: number;
}

export interface PaidToolDeps {
  fetchProduct: (
    baseUrl: string,
    path: string,
    params: Record<string, string>,
    fetchImpl?: FetchLike,
  ) => Promise<Response>;
  createPaidFetch: (privateKey: string, network: string) => FetchLike;
  decodeSettlement: (response: Response) => Settlement | null;
}

export const defaultDeps: PaidToolDeps = { fetchProduct, createPaidFetch, decodeSettlement };

function textResult(text: string, isError = false): ToolTextResult {
  return { content: [{ type: "text", text }], isError };
}

/**
 * Calls a paid catalog route and handles the full x402 flow: pass-through
 * when the server didn't require payment (e.g. FREE_MODE), return the
 * decoded challenge when no buyer key is configured or the spending guard
 * refuses it, or pay automatically and return the result plus a payment
 * receipt block.
 */
export async function callPaidTool(
  entry: CatalogEntry,
  params: Record<string, string>,
  config: PaidToolConfig,
  deps: PaidToolDeps = defaultDeps,
): Promise<ToolTextResult> {
  const initialRes = await deps.fetchProduct(config.baseUrl, entry.path, params);

  if (initialRes.status !== 402) {
    if (!initialRes.ok) {
      return textResult(`Request failed: HTTP ${initialRes.status}`, true);
    }
    const data = await initialRes.json();
    return textResult(JSON.stringify(data, null, 2));
  }

  const header = initialRes.headers.get("payment-required");
  if (!header) {
    return textResult(
      "Server responded 402 but without a payment-required header; cannot decode the challenge.",
      true,
    );
  }

  const challenge = decodeChallenge(header);

  if (!config.buyerPrivateKey) {
    return textResult(
      JSON.stringify({ challenge, message: formatChallengeMessage(challenge) }, null, 2),
    );
  }

  if (!isWithinSpendingGuard(challenge.amountUsd, config.maxPriceUsd)) {
    return textResult(
      JSON.stringify(
        {
          challenge,
          message: formatChallengeMessage(challenge, {
            guardExceeded: true,
            maxUsd: config.maxPriceUsd,
          }),
        },
        null,
        2,
      ),
    );
  }

  const paidFetch = deps.createPaidFetch(config.buyerPrivateKey, config.network);
  const paidRes = await deps.fetchProduct(config.baseUrl, entry.path, params, paidFetch);

  if (!paidRes.ok) {
    return textResult(`Paid request failed: HTTP ${paidRes.status}`, true);
  }

  const data = await paidRes.json();
  const settlement = deps.decodeSettlement(paidRes);

  return textResult(
    JSON.stringify(
      {
        result: data,
        payment: settlement
          ? {
              amountUsd: challenge.amountUsd,
              network: settlement.network,
              transaction: settlement.transaction,
            }
          : null,
      },
      null,
      2,
    ),
  );
}
