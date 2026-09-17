import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "./server.js";
import type { PaidToolDeps } from "./paidTool.js";

const packageTrustEntry = {
  id: "package-trust",
  path: "/v1/package-trust",
  price_usd: 0.05,
  description: "Install-safety signals",
  input_schema: {
    type: "object",
    properties: {
      ecosystem: { type: "string", enum: ["npm", "pypi"] },
      name: { type: "string" },
    },
    required: ["ecosystem", "name"],
  },
  output_schema: { type: "object", properties: {} },
};

const repoMergeEntry = {
  id: "repo-merge",
  path: "/v1/repo-merge",
  price_usd: 0.05,
  description: "Merge likelihood",
  input_schema: {
    type: "object",
    properties: { repo: { type: "string" } },
    required: ["repo"],
  },
  output_schema: { type: "object", properties: {} },
};

const a11yAuditEntry = {
  id: "a11y-audit",
  path: "/v1/a11y-audit",
  price_usd: 0.08,
  description: "WCAG audit",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", maxLength: 2048 },
      viewport: { type: "string", enum: ["desktop", "mobile"], default: "desktop" },
      wcag: { type: "string", enum: ["2.1-aa", "2.2-aa"], default: "2.2-aa" },
    },
    required: ["url"],
  },
  output_schema: { type: "object", properties: {} },
};

type RegisteredTools = Record<string, { description?: string; handler: (args: unknown, extra: unknown) => unknown }>;

function tools(server: Awaited<ReturnType<typeof createServer>>): RegisteredTools {
  return (server as unknown as { _registeredTools: RegisteredTools })._registeredTools;
}

let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  stderrSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe("createServer", () => {
  it("registers list_products plus one tool per paid catalog entry, priced from the live catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([packageTrustEntry, repoMergeEntry]), { status: 200 }),
      ),
    );

    const server = await createServer({
      baseUrl: "https://api.example.com",
      network: "eip155:8453",
      maxPriceUsd: 0.1,
    });
    const registered = tools(server);

    expect(Object.keys(registered).sort()).toEqual([
      "list_products",
      "package_trust_check",
      "repo_merge_lookup",
    ]);
    expect(registered.package_trust_check.description).toContain("$0.05");
    expect(registered.package_trust_check.description).not.toContain("bundled fallback");
  });

  it("falls back to the bundled catalog and marks paid-tool descriptions accordingly when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const server = await createServer({
      baseUrl: "https://api.example.com",
      network: "eip155:8453",
      maxPriceUsd: 0.1,
    });
    const registered = tools(server);

    expect(registered.package_trust_check.description).toContain("bundled fallback");
    expect(registered.repo_merge_lookup.description).toContain("bundled fallback");
  });

  it("coerces non-string tool arguments to strings before delegating to callPaidTool", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([packageTrustEntry]), { status: 200 })),
    );

    const deps: PaidToolDeps = {
      fetchProduct: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
      createPaidFetch: vi.fn(),
      decodeSettlement: vi.fn(),
    };

    const server = await createServer(
      { baseUrl: "https://api.example.com", network: "eip155:8453", maxPriceUsd: 0.1 },
      deps,
    );
    const registered = tools(server);

    await registered.package_trust_check.handler({ ecosystem: "npm", name: "left-pad" }, {});

    expect(deps.fetchProduct).toHaveBeenCalledWith(
      "https://api.example.com",
      "/v1/package-trust",
      { ecosystem: "npm", name: "left-pad" },
    );
  });

  it("registers a11y_audit from the catalog and forwards url/viewport/wcag as query params", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([a11yAuditEntry]), { status: 200 })),
    );
    const deps: PaidToolDeps = {
      fetchProduct: vi.fn().mockResolvedValue(new Response(JSON.stringify({ score: 90 }), { status: 200 })),
      createPaidFetch: vi.fn(),
      decodeSettlement: vi.fn(),
    };

    const server = await createServer(
      { baseUrl: "https://api.example.com", network: "eip155:8453", maxPriceUsd: 0.1 },
      deps,
    );
    const registered = tools(server);

    expect(registered.a11y_audit).toBeDefined();
    expect(registered.a11y_audit.description).toContain("$0.08");

    await registered.a11y_audit.handler({ url: "https://example.com", wcag: "2.1-aa" }, {});

    expect(deps.fetchProduct).toHaveBeenCalledWith(
      "https://api.example.com",
      "/v1/a11y-audit",
      { url: "https://example.com", wcag: "2.1-aa" },
    );
  });

  it("list_products always calls the live API at call time, independent of the startup catalog source", async () => {
    const liveFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([packageTrustEntry]), { status: 200 }),
      ) // startup load
      .mockResolvedValueOnce(
        new Response(JSON.stringify([packageTrustEntry, repoMergeEntry]), { status: 200 }),
      ); // list_products call
    vi.stubGlobal("fetch", liveFetch);

    const server = await createServer({
      baseUrl: "https://api.example.com",
      network: "eip155:8453",
      maxPriceUsd: 0.1,
    });
    const registered = tools(server);

    const result = (await registered.list_products.handler({}, {})) as {
      content: Array<{ text: string }>;
    };

    expect(liveFetch).toHaveBeenCalledTimes(2);
    expect(result.content[0].text).toContain("repo-merge");
  });
});
