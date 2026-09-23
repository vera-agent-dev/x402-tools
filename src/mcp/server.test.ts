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

const scheduleSolveEntry = {
  id: "schedule-solve",
  path: "/v1/schedule-solve",
  method: "POST",
  price_usd: 0.3,
  description: "Solves a scheduling/roster problem",
  input_schema: {
    type: "object",
    properties: {
      slots: { type: "array", items: { type: "object" } },
      resources: { type: "array", items: { type: "object" } },
      demands: { type: "array", items: { type: "object" } },
    },
    required: ["slots", "resources", "demands"],
  },
  output_schema: { type: "object", properties: {} },
};

const mxRfcEntry = {
  id: "mx-rfc",
  path: "/v1/mx/rfc",
  method: "POST",
  price_usd: 0.03,
  description: "Structural validation of a Mexican RFC",
  input_schema: {
    type: "object",
    properties: { rfc: { type: "string" } },
    required: ["rfc"],
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

  it("registers schedule_solve from the catalog and forwards nested slots/resources/demands as a JSON body, not stringified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([scheduleSolveEntry]), { status: 200 })),
    );
    const deps: PaidToolDeps = {
      fetchProduct: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ status: "optimal" }), { status: 200 })),
      createPaidFetch: vi.fn(),
      decodeSettlement: vi.fn(),
    };

    const server = await createServer(
      { baseUrl: "https://api.example.com", network: "eip155:8453", maxPriceUsd: 0.5 },
      deps,
    );
    const registered = tools(server);

    expect(registered.schedule_solve).toBeDefined();
    expect(registered.schedule_solve.description).toContain("$0.30");

    const body = { slots: [{ id: "mon-9am" }], resources: [{ id: "alice" }], demands: [] };
    await registered.schedule_solve.handler(body, {});

    expect(deps.fetchProduct).toHaveBeenCalledWith(
      "https://api.example.com",
      "/v1/schedule-solve",
      body,
      undefined,
      "POST",
    );
  });

  it("registers mx_rfc_validate from the catalog and forwards the rfc field as a JSON body, never a query string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([mxRfcEntry]), { status: 200 })),
    );
    const deps: PaidToolDeps = {
      fetchProduct: vi.fn().mockResolvedValue(new Response(JSON.stringify({ valid: true }), { status: 200 })),
      createPaidFetch: vi.fn(),
      decodeSettlement: vi.fn(),
    };

    const server = await createServer(
      { baseUrl: "https://api.example.com", network: "eip155:8453", maxPriceUsd: 0.1 },
      deps,
    );
    const registered = tools(server);

    expect(registered.mx_rfc_validate).toBeDefined();
    expect(registered.mx_rfc_validate.description).toContain("$0.03");

    await registered.mx_rfc_validate.handler({ rfc: "EKU9003173C9" }, {});

    expect(deps.fetchProduct).toHaveBeenCalledWith(
      "https://api.example.com",
      "/v1/mx/rfc",
      { rfc: "EKU9003173C9" },
      undefined,
      "POST",
    );
    // Regression guard: the PII-bearing field must never be serialized into a
    // URL/query string anywhere in the call args.
    for (const call of (deps.fetchProduct as ReturnType<typeof vi.fn>).mock.calls) {
      for (const arg of call) {
        if (typeof arg === "string") {
          expect(arg).not.toContain("EKU9003173C9");
        }
      }
    }
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
