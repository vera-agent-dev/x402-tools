import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchCatalog } from "../adapters/apiClient.js";
import { describeToolWithPrice, findProduct, jsonSchemaToZodShape } from "../domain/catalog.js";
import { loadCatalog } from "./catalogLoader.js";
import { callPaidTool, defaultDeps, type PaidToolDeps } from "./paidTool.js";

export interface ServerConfig {
  baseUrl: string;
  buyerPrivateKey?: string;
  network: string;
  maxPriceUsd: number;
}

const PAID_TOOLS = [
  { catalogId: "package-trust", toolName: "package_trust_check" },
  { catalogId: "repo-merge", toolName: "repo_merge_lookup" },
] as const;

/**
 * Builds the MCP server. Tool descriptions/input schemas for the paid tools
 * are derived from the live catalog fetched here at startup (falling back to
 * the bundled static copy, with that fact surfaced via list_products).
 */
export async function createServer(
  config: ServerConfig,
  deps: PaidToolDeps = defaultDeps,
): Promise<McpServer> {
  const server = new McpServer({ name: "x402-tools", version: "0.1.0" });
  const { entries: catalog, source } = await loadCatalog(config.baseUrl);

  server.registerTool(
    "list_products",
    {
      title: "List x402 products",
      description:
        "Free. Fetches the live product catalog from the x402-tools seller API " +
        "(prices, ids and schemas are never hardcoded here).",
      inputSchema: {},
    },
    async () => {
      try {
        const live = await fetchCatalog(config.baseUrl);
        return {
          content: [{ type: "text", text: JSON.stringify({ source: "live", products: live }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  source: "bundled (API unreachable)",
                  products: catalog,
                  error: error instanceof Error ? error.message : String(error),
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );

  for (const { catalogId, toolName } of PAID_TOOLS) {
    const entry = findProduct(catalog, catalogId);
    if (!entry) continue;

    server.registerTool(
      toolName,
      {
        title: toolName,
        description:
          describeToolWithPrice(entry) +
          (source === "bundled" ? " [catalog: bundled fallback, API was unreachable at startup]" : ""),
        inputSchema: jsonSchemaToZodShape(entry.input_schema) as Record<string, z.ZodTypeAny>,
      },
      async (args: Record<string, unknown>) => {
        const stringArgs: Record<string, string> = {};
        for (const [key, value] of Object.entries(args)) {
          if (value !== undefined) stringArgs[key] = String(value);
        }
        return callPaidTool(entry, stringArgs, config, deps);
      },
    );
  }

  return server;
}
