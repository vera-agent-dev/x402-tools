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

/**
 * Fetches the free, live product catalog from the seller API. An optional
 * `signal` lets the caller bound how long a stalled seller can block startup
 * (see mcp/catalogLoader.ts, which times this out and falls back to bundled).
 */
export async function fetchCatalog(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal,
): Promise<CatalogEntry[]> {
  const res = signal
    ? await fetchImpl(`${baseUrl}/products`, { signal })
    : await fetchImpl(`${baseUrl}/products`);
  if (!res.ok) {
    throw new ApiError(`Failed to fetch catalog: HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as CatalogEntry[];
}

/**
 * Calls a (possibly paid) product route and returns the raw Response,
 * including on a 402 — the caller decides how to react to that status.
 *
 * `path` comes from the remote, untrusted catalog. Resolving it against
 * `baseUrl` with `new URL()` would let an absolute URL (or a protocol-
 * relative one) silently redirect the call — and any auto-payment it
 * triggers — to an arbitrary origin. The resolved origin is asserted to
 * match the configured base before anything is fetched.
 */
export async function fetchProduct(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const url = new URL(path, baseUrl);
  const expectedOrigin = new URL(baseUrl).origin;
  if (url.origin !== expectedOrigin) {
    throw new Error(
      `Refusing to call "${url.origin}": catalog path "${path}" resolved outside the configured base origin "${expectedOrigin}".`,
    );
  }

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return fetchImpl(url.toString(), { method: "GET" });
}
