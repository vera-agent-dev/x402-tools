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
    params: Record<string, unknown>,
    fetchImpl?: FetchLike,
    method?: "GET" | "POST",
  ) => Promise<Response>;
  createPaidFetch: (privateKey: string, network: string, maxPriceUsd: number) => FetchLike;
  decodeSettlement: (response: Response) => Settlement | null;
}

export const defaultDeps: PaidToolDeps = { fetchProduct, createPaidFetch, decodeSettlement };

function textResult(text: string, isError = false): ToolTextResult {
  return { content: [{ type: "text", text }], isError };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Calls a paid catalog route and handles the full x402 flow: pass-through
 * when the server didn't require payment (e.g. FREE_MODE), return the
 * decoded challenge when no buyer key is configured or the spending guard
 * refuses it, or pay automatically and return the result plus a payment
 * receipt block.
 *
 * Two layers enforce X402_MAX_PRICE_USD:
 *  - A local pre-check here, using the challenge decoded for `config.network`
 *    specifically (not `accepts[0]`) — a seller may list several accepts
 *    across networks, and only the one matching the buyer's configured
 *    network is the candidate that could actually be paid.
 *  - The authoritative one: `createPaidFetch` configures the real x402
 *    client's `setSpendControls`, which enforces the cap on whatever accept
 *    it actually selects and signs. If that ever disagrees with the local
 *    pre-check (e.g. a scheme/asset the pre-check didn't anticipate), the
 *    library itself throws and is caught below instead of ever paying.
 */
export async function callPaidTool(
  entry: CatalogEntry,
  params: Record<string, unknown>,
  config: PaidToolConfig,
  deps: PaidToolDeps = defaultDeps,
): Promise<ToolTextResult> {
  // Preserves the exact (fewer-argument) call shape for GET entries — only
  // POST entries (e.g. schedule-solve) need the method threaded through, so
  // it's passed explicitly only then.
  const initialRes =
    entry.method === "POST"
      ? await deps.fetchProduct(config.baseUrl, entry.path, params, undefined, "POST")
      : await deps.fetchProduct(config.baseUrl, entry.path, params);

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

  let challenge;
  try {
    challenge = decodeChallenge(header, config.network);
  } catch (error) {
    return textResult(`Could not decode payment-required header: ${errorMessage(error)}`, true);
  }

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

  const paidFetch = deps.createPaidFetch(config.buyerPrivateKey, config.network, config.maxPriceUsd);

  let paidRes: Response;
  try {
    paidRes =
      entry.method === "POST"
        ? await deps.fetchProduct(config.baseUrl, entry.path, params, paidFetch, "POST")
        : await deps.fetchProduct(config.baseUrl, entry.path, params, paidFetch);
  } catch (error) {
    // The real x402 client's spend controls rejected every candidate accept
    // (the authoritative check — see the docstring above). Treat this as a
    // legitimate refusal, same shape as the local pre-check failing.
    return textResult(
      JSON.stringify(
        {
          challenge,
          message:
            formatChallengeMessage(challenge, {
              guardExceeded: true,
              maxUsd: config.maxPriceUsd,
            }) + ` (refused by the payment client: ${errorMessage(error)})`,
        },
        null,
        2,
      ),
    );
  }

  if (!paidRes.ok) {
    return textResult(`Paid request failed: HTTP ${paidRes.status}`, true);
  }

  // Payment has already settled by this point. Parsing the result or the
  // settlement header must never throw past this — that would lose the tx
  // hash and risk the caller retrying (and paying twice) a call that
  // actually succeeded.
  const bodyForFallback = paidRes.clone();
  let data: unknown;
  let settlement: Settlement | null = null;
  const parseErrors: string[] = [];

  try {
    data = await paidRes.json();
  } catch (error) {
    parseErrors.push(`response body: ${errorMessage(error)}`);
  }

  try {
    settlement = deps.decodeSettlement(paidRes);
  } catch (error) {
    parseErrors.push(`settlement header: ${errorMessage(error)}`);
  }

  if (parseErrors.length > 0) {
    const rawBody = await bodyForFallback.text().catch(() => null);
    return textResult(
      JSON.stringify(
        {
          raw_body: rawBody,
          payment: {
            amountUsd: challenge.amountUsd,
            network: settlement?.network ?? challenge.network,
            transaction: settlement?.transaction ?? null,
          },
          note:
            `Payment already succeeded but the response could not be fully parsed ` +
            `(${parseErrors.join("; ")}). Do not retry this call — that would pay again. ` +
            `See raw_body above.`,
        },
        null,
        2,
      ),
    );
  }

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
