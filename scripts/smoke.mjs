// Smoke test: starts the x402-tools MCP server as a child process over
// stdio and calls all three tools against a locally running seller API
// (expected to be in FREE_MODE, i.e. no PAY_TO set, so calls succeed
// without needing a funded wallet).
//
//   X402_BASE_URL=http://localhost:3000 node scripts/smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const baseUrl = process.env.X402_BASE_URL ?? "http://localhost:3000";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, X402_BASE_URL: baseUrl },
});

const client = new Client({ name: "x402-tools-smoke", version: "0.1.0" });
await client.connect(transport);

function truncate(text, max = 400) {
  return text.length > max ? `${text.slice(0, max)}...(truncated)` : text;
}

console.log("== list_products ==");
const products = await client.callTool({ name: "list_products", arguments: {} });
console.log(truncate(products.content[0].text));

console.log("\n== package_trust_check ==");
const trust = await client.callTool({
  name: "package_trust_check",
  arguments: { ecosystem: "npm", name: "left-pad" },
});
console.log(truncate(trust.content[0].text));

console.log("\n== repo_merge_lookup ==");
const merge = await client.callTool({
  name: "repo_merge_lookup",
  arguments: { repo: "facebook/react" },
});
console.log(truncate(merge.content[0].text));

await client.close();
process.exit(0);
