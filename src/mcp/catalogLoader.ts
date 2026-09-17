import { fetchCatalog, type FetchLike } from "../adapters/apiClient.js";
import { BUNDLED_CATALOG } from "../domain/bundledCatalog.js";
import type { CatalogEntry } from "../domain/catalog.js";

export type CatalogSource = "live" | "bundled";

export interface LoadedCatalog {
  entries: CatalogEntry[];
  source: CatalogSource;
}

/** Loads the live catalog, falling back to the bundled static copy on any failure. */
export async function loadCatalog(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<LoadedCatalog> {
  try {
    const entries = await fetchCatalog(baseUrl, fetchImpl);
    return { entries, source: "live" };
  } catch {
    return { entries: BUNDLED_CATALOG, source: "bundled" };
  }
}
