#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp/server.js";
import { DEFAULT_NETWORK } from "./domain/network.js";

const baseUrl = process.env.X402_BASE_URL ?? "https://x402-api.fly.dev"; // TODO: set once deployed
const buyerPrivateKey = process.env.X402_BUYER_PRIVATE_KEY;
const network = process.env.X402_NETWORK ?? DEFAULT_NETWORK;
const maxPriceUsd = Number(process.env.X402_MAX_PRICE_USD ?? "0.10");

async function main() {
  const server = await createServer({ baseUrl, buyerPrivateKey, network, maxPriceUsd });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `x402-tools MCP server running (stdio). base=${baseUrl} network=${network} ` +
      `payments=${buyerPrivateKey ? "enabled" : "disabled (challenge-only mode)"} ` +
      `maxPriceUsd=${maxPriceUsd}`,
  );
}

main().catch((error) => {
  console.error("x402-tools failed to start:", error);
  process.exit(1);
});
