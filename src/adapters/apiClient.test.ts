import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCatalog, fetchProduct, ApiError } from "./apiClient.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCatalog", () => {
  it("fetches and returns the /products catalog", async () => {
    const catalog = [{ id: "package-trust", path: "/v1/package-trust" }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(catalog), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCatalog("https://api.example.com");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/products");
    expect(result).toEqual(catalog);
  });

  it("throws an ApiError when the catalog request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );

    await expect(fetchCatalog("https://api.example.com")).rejects.toThrow(ApiError);
  });

  it("forwards an AbortSignal so a stalled seller can be timed out by the caller", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    const controller = new AbortController();

    await fetchCatalog("https://api.example.com", fetchMock, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/products",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe("fetchProduct", () => {
  it("builds the query string and returns the raw Response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchProduct("https://api.example.com", "/v1/package-trust", {
      ecosystem: "npm",
      name: "left-pad",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/package-trust?ecosystem=npm&name=left-pad",
      expect.any(Object),
    );
  });

  it("returns the raw Response even on a 402, without throwing", async () => {
    const response = new Response("{}", {
      status: 402,
      headers: { "payment-required": "abc" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await fetchProduct("https://api.example.com", "/v1/repo-merge", {
      repo: "facebook/react",
    });

    expect(result.status).toBe(402);
    expect(result.headers.get("payment-required")).toBe("abc");
  });

  it("accepts an injected fetch implementation instead of the global one", async () => {
    const customFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    await fetchProduct(
      "https://api.example.com",
      "/v1/package-trust",
      { ecosystem: "npm", name: "left-pad" },
      customFetch,
    );

    expect(customFetch).toHaveBeenCalled();
  });

  it("refuses a catalog path that resolves to a different origin than the configured base", async () => {
    const fetchMock = vi.fn();

    await expect(
      fetchProduct(
        "https://api.example.com",
        "https://evil.example.com/steal",
        { a: "b" },
        fetchMock,
      ),
    ).rejects.toThrow(/origin/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a protocol-relative path that would escape the configured origin", async () => {
    const fetchMock = vi.fn();

    await expect(
      fetchProduct("https://api.example.com", "//evil.example.com/steal", {}, fetchMock),
    ).rejects.toThrow(/origin/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a JSON body (no query string) for a POST product, e.g. schedule-solve", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    const body = { slots: [{ id: "mon-9am" }], resources: [{ id: "alice" }], demands: [] };
    await fetchProduct("https://api.example.com", "/v1/schedule-solve", body, fetchMock, "POST");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/schedule-solve",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" }),
        body: JSON.stringify(body),
      }),
    );
  });

  it("defaults to GET with query params when method is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    await fetchProduct("https://api.example.com", "/v1/package-trust", {
      ecosystem: "npm",
      name: "left-pad",
    }, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/package-trust?ecosystem=npm&name=left-pad",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
