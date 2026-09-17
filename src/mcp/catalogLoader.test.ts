import { describe, expect, it, vi } from "vitest";
import { loadCatalog } from "./catalogLoader.js";
import { BUNDLED_CATALOG } from "../domain/bundledCatalog.js";

describe("loadCatalog", () => {
  it("returns the live catalog when the API is reachable", async () => {
    const live = [{ id: "package-trust" }];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(live), { status: 200 }));

    const result = await loadCatalog("https://api.example.com", fetchImpl as unknown as typeof fetch);

    expect(result.source).toBe("live");
    expect(result.entries).toEqual(live);
  });

  it("falls back to the bundled catalog, marked as such, when the API is unreachable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await loadCatalog("https://api.example.com", fetchImpl as unknown as typeof fetch);

    expect(result.source).toBe("bundled");
    expect(result.entries).toEqual(BUNDLED_CATALOG);
  });

  it("falls back to bundled when the API responds with an error status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));

    const result = await loadCatalog("https://api.example.com", fetchImpl as unknown as typeof fetch);

    expect(result.source).toBe("bundled");
  });
});
