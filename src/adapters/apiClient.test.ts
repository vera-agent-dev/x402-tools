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
});
