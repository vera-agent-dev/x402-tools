# x402-tools

An MCP server that lets an AI agent pay, per call, for a set of small
trust-signal and utility lookups over the [x402](https://www.x402.org/)
protocol: package install-safety, GitHub PR-merge likelihood, WCAG
accessibility audits, roster/scheduling solving, and Mexican RFC/CLABE/CFDI
validation. The catalog and every price are read live from the seller API at
call time — nothing here is hardcoded.

## Built and operated by an AI agent, under a human owner

This tool was built by an AI coding agent (Claude), and the paid tools it
calls run against a seller API that an AI agent may also autonomously pay
and query. A human owner (the repository author) controls the wallet, the
spending guard, and the seller side. Treat any output from these tools as a
signal, not a guarantee — see "What this does not do" below.

## Tools

| Tool | Price | Answers |
| --- | --- | --- |
| `list_products` | Free | The live product catalog: ids, paths, prices, input/output schemas. |
| `package_trust_check` | Fetched live via `list_products` (currently $0.05 USDC) | Is this npm/PyPI package safe to install? Registry metadata, install-script usage, OSV advisories, typosquat risk, 0-100 score. |
| `repo_merge_lookup` | Fetched live via `list_products` (currently $0.05 USDC) | Will this GitHub repo merge an AI-authored or external PR? Stated AI/contribution policy plus historical merge rates, 0-100 score. |
| `a11y_audit` | Fetched live via `list_products` (currently $0.08 USDC) | Is this public page accessible? WCAG 2.1/2.2 AA audit with headless Chromium + axe-core: violations by impact, per-rule detail, 0-100 score. |
| `schedule_solve` | Fetched live via `list_products` (currently $0.30 USDC) | Solves a scheduling/roster problem (gym rosters, dance-school timetables, shift plans) with OR-Tools CP-SAT: assigns resources to slot demands honoring availability, tags, and constraints. Takes a JSON body (`slots`, `resources`, `demands`, optional `constraints`/`objective`), not query params. |
| `mx_rfc_validate` | Fetched live via `list_products` (currently $0.03 USDC) | Structural validation of a Mexican RFC (persona física/moral, embedded date, SAT check digit) plus Article 69-B (EFOS) blacklist status. |
| `mx_clabe_validate` | Fetched live via `list_products` (currently $0.02 USDC) | Validates an 18-digit Mexican CLABE: check digit, bank identification, plaza, and account number. |
| `mx_cfdi_verify` | Fetched live via `list_products` (currently $0.05 USDC) | Verifies a Mexican electronic invoice (CFDI) with SAT: status (vigente/cancelado), cancelability, and EFOS validation. |

Prices shown above are a snapshot at the time of writing and are never read
by the code — always call `list_products` for the current catalog.

## What this does not do

Scores are a heuristic signal built from public metadata (registry fields,
advisory databases, repo history). They are not a security audit and not a
guarantee that a package is safe or that a PR will merge. Use them as one
input among several.

## Install

### npx (no local checkout)

```json
{
  "mcpServers": {
    "x402-tools": {
      "command": "npx",
      "args": ["-y", "github:vera-agent-dev/x402-tools"],
      "env": {
        "X402_BASE_URL": "https://x402-api-24223879872.us-east1.run.app"
      }
    }
  }
}
```

Once published to npm, the same config works with `"args": ["-y", "x402-tools"]`.

### Local checkout

```bash
git clone https://github.com/vera-agent-dev/x402-tools
cd x402-tools
npm install
npm run build
```

```json
{
  "mcpServers": {
    "x402-tools": {
      "command": "node",
      "args": ["/absolute/path/to/x402-tools/dist/index.js"],
      "env": { "X402_BASE_URL": "https://x402-api-24223879872.us-east1.run.app" }
    }
  }
}
```

### Claude Code plugin

This repo ships `.claude-plugin/plugin.json`, so it installs like any other
Claude Code plugin pointing at this GitHub repository.

### Plain MCP JSON config

Any MCP-compatible client can use the `.mcp.json` in this repo directly, or
copy its `mcpServers.x402-tools` block into your own client config.

`.mcp.json` is a tracked file. Its `X402_BUYER_PRIVATE_KEY` value is the
literal string `${X402_BUYER_PRIVATE_KEY}` — an env-var reference, not a
real key — for clients that support that substitution. **Never replace it
with an actual private key and commit that.** If your client doesn't
support `${VAR}` substitution in MCP config, set the env var in your own
untracked client config instead of editing this file in place.

## Payment flow

1. `list_products` is always free and always live — no wallet needed.
2. Calling a paid tool without `X402_BUYER_PRIVATE_KEY` set performs the
   request; on a 402 it returns the **decoded challenge** (amount, asset,
   network, `payTo`) as structured output, plus a short message on how to
   pay — either by setting the env var, or manually using the snippets in
   `snippets/`.
3. With `X402_BUYER_PRIVATE_KEY` set, the server wraps `fetch` with
   `@x402/fetch` + `@x402/evm` and pays automatically, then returns the
   result plus a `payment` block (amount, network, transaction hash).
4. A spending guard, `X402_MAX_PRICE_USD` (default `0.30`), refuses to pay
   any single challenge above that amount and returns the challenge instead
   — the same as running with no key configured. This is enforced twice: a
   local pre-check on the accept matching your configured network, and
   (authoritatively) via the x402 client's own `setSpendControls`, which
   caps whatever accept it actually selects and signs — so a seller
   offering several `accepts` across networks/assets can't bypass the cap.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `X402_BASE_URL` | `https://x402-api-24223879872.us-east1.run.app` | Base URL of the seller API. |
| `X402_BUYER_PRIVATE_KEY` | _(unset)_ | Private key of the paying wallet. Omit to run in challenge-only mode. |
| `X402_NETWORK` | `eip155:8453` (Base) | CAIP-2 network id. Use `eip155:84532` for Base Sepolia testnet. |
| `X402_MAX_PRICE_USD` | `0.30` | Spending guard: max USD per single paid call. |

## Security: `X402_BUYER_PRIVATE_KEY`

This is **your own wallet's** private key, not this project's. Use a
dedicated, low-balance wallet you top up only with what you're willing to
spend automatically — never your main wallet. The key is read from the
environment, used locally to sign payments via viem, and never logged or
sent anywhere except as part of a signed x402 payment authorization. Paid
tool arguments (e.g. the package name or repo you're looking up) are sent to
the seller API as ordinary query parameters (as a JSON body for POST tools
like `schedule_solve`) — don't pass anything sensitive.

## Publishing (maintainer notes)

- npm: package name `x402-tools`, `npm publish` once ready; update
  `server.json` and this README's npx snippet to drop the `github:` prefix.
- MCP Registry: `server.json` follows the `io.github.vera-agent-dev/x402-tools`
  naming convention from the [registry schema](https://github.com/modelcontextprotocol/registry).

## Dev / test

```bash
npm install
npm test          # vitest, mocks fetch — no network, no spend
npm run build      # tsc -> dist/
npm run dev        # tsx src/index.ts
npm run smoke      # end-to-end stdio smoke test against a running seller API
```

## Open TODOs

- The seller API currently runs on Base Sepolia (testnet USDC); mainnet switch pending.
- Not yet published to npm; install via `npx github:vera-agent-dev/x402-tools`
  until then.

## Links

- x402 protocol: https://www.x402.org/
- MCP: https://modelcontextprotocol.io/
- MCP Registry: https://github.com/modelcontextprotocol/registry

## License

MIT — see [LICENSE](./LICENSE).
