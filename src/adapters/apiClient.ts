import type { CatalogEntry } from "../domain/catalog.js";

export type FetchLike = typeof fetch;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fetches the free, live product catalog from the seller API. */
export async function fetchCatalog(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<CatalogEntry[]> {
  const res = await fetchImpl(`${baseUrl}/products`);
  if (!res.ok) {
    throw new ApiError(`Failed to fetch catalog: HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as CatalogEntry[];
}

/**
 * Calls a (possibly paid) product route and returns the raw Response,
 * including on a 402 — the caller decides how to react to that status.
 */
export async function fetchProduct(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return fetchImpl(url.toString(), { method: "GET" });
}
