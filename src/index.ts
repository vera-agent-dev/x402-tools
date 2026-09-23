#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp/server.js";
import { parseEnv } from "./domain/env.js";

// `--version` (and `--help`, which just points to it) let `npx
// github:.../x402-tools --version` verify the bin actually launches without
// needing a full MCP handshake — most MCP clients don't support `--help`.
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as {
    version: string;
  };
  console.log(pkg.version);
  process.exit(0);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(
    "x402-tools: an MCP stdio server for x402-paid package-trust, repo-merge, a11y-audit, " +
      "schedule-solve and mx-rfc/mx-clabe/mx-cfdi lookups.\n" +
      "Usage: x402-tools (no arguments; run as an MCP server over stdio)\n" +
      "       x402-tools --version\n" +
      "Env: X402_BASE_URL, X402_BUYER_PRIVATE_KEY, X402_NETWORK, X402_MAX_PRICE_USD\n" +
      "See https://github.com/vera-agent-dev/x402-tools for details.",
  );
  process.exit(0);
}

async function main() {
  const config = parseEnv(process.env);
  const server = await createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `x402-tools MCP server running (stdio). base=${config.baseUrl} network=${config.network} ` +
      `payments=${config.buyerPrivateKey ? "enabled" : "disabled (challenge-only mode)"} ` +
      `maxPriceUsd=${config.maxPriceUsd}`,
  );
}

main().catch((error) => {
  console.error("x402-tools failed to start:", error instanceof Error ? error.message : error);
  process.exit(1);
});
