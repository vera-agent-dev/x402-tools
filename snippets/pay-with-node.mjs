// Manually pay a single x402 402 challenge and retry the request.
//
// Adapted from x402-api's scripts/paid-call.mjs (the seller's own proof
// buyer script). Requires a funded EVM wallet's private key.
//
//   npm install @x402/fetch @x402/evm viem
//   BUYER_PRIVATE_KEY=0x... node snippets/pay-with-node.mjs [url]
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";

const url =
  process.argv[2] ??
  "https://x402-api.fly.dev/v1/package-trust?ecosystem=npm&name=left-pad";
const network = process.env.NETWORK ?? "eip155:8453"; // eip155:84532 for Base Sepolia
const privateKey = process.env.BUYER_PRIVATE_KEY;

if (!privateKey) {
  console.error("Set BUYER_PRIVATE_KEY to a funded wallet's private key.");
  process.exit(1);
}

const chain = network === "eip155:84532" ? baseSepolia : base;
const publicClient = createPublicClient({ chain, transport: http() });
const account = privateKeyToAccount(privateKey);
const signer = toClientEvmSigner(account, publicClient);

const client = new x402Client().register(network, new ExactEvmScheme(signer));
const fetchWithPay = wrapFetchWithPayment(fetch, client);

console.log(`buyer: ${account.address}`);
console.log(`target: ${url}`);

const res = await fetchWithPay(url);
console.log(`status: ${res.status}`);

const settlementHeader = res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
if (settlementHeader) {
  const settlement = decodePaymentResponseHeader(settlementHeader);
  console.log("settlement:", settlement);
}

console.log("body:", await res.text());
