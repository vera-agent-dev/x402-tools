import { fetchCatalog, type FetchLike } from "../adapters/apiClient.js";
import { BUNDLED_CATALOG } from "../domain/bundledCatalog.js";
import { validateCatalog, type CatalogEntry } from "../domain/catalog.js";

export type CatalogSource = "live" | "bundled";

export interface LoadedCatalog {
  entries: CatalogEntry[];
  source: CatalogSource;
}

const CATALOG_FETCH_TIMEOUT_MS = 5000;

/**
 * Loads the live catalog, schema-validates it, and falls back to the
 * bundled static copy (logging why, to stderr) on any failure: unreachable
 * seller, non-2xx response, a slow seller that misses the timeout, or a
 * response that doesn't pass validateCatalog. This runs at startup before
 * the server connects, so it must never hang indefinitely.
 */
export async function loadCatalog(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<LoadedCatalog> {
  try {
    const raw = await fetchCatalog(baseUrl, fetchImpl, AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS));
    const entries = validateCatalog(raw);
    return { entries, source: "live" };
  } catch (error) {
    console.error(
      `[x402-tools] Failed to load live catalog from ${baseUrl}, falling back to bundled catalog: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { entries: BUNDLED_CATALOG, source: "bundled" };
  }
}
