import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCatalog } from "./catalogLoader.js";
import { BUNDLED_CATALOG } from "../domain/bundledCatalog.js";

const validEntry = {
  id: "package-trust",
  path: "/v1/package-trust",
  price_usd: 0.05,
  description: "Install-safety signals",
  input_schema: { type: "object", properties: {} },
  output_schema: { type: "object", properties: {} },
};

let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  stderrSpy.mockRestore();
});

describe("loadCatalog", () => {
  it("returns the live catalog when the API is reachable and schema-valid", async () => {
    const live = [validEntry];
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
    expect(stderrSpy).toHaveBeenCalled();
  });

  it("falls back to bundled when the API responds with an error status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));

    const result = await loadCatalog("https://api.example.com", fetchImpl as unknown as typeof fetch);

    expect(result.source).toBe("bundled");
  });

  it("falls back to bundled and logs to stderr when the live catalog fails schema validation", async () => {
    const malformed = [{ ...validEntry, price_usd: "not-a-number" }];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(malformed), { status: 200 }));

    const result = await loadCatalog("https://api.example.com", fetchImpl as unknown as typeof fetch);

    expect(result.source).toBe("bundled");
    expect(result.entries).toEqual(BUNDLED_CATALOG);
    expect(stderrSpy).toHaveBeenCalled();
  });

  it("passes an AbortSignal to the fetch so a stalled seller cannot block startup forever", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([validEntry]), { status: 200 }));

    await loadCatalog("https://api.example.com", fetchImpl as unknown as typeof fetch);

    const [, options] = fetchImpl.mock.calls[0];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
});
