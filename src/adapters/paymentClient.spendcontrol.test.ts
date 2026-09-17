import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaidFetch } from "./paymentClient.js";

// Deliberately does NOT mock @x402/fetch, @x402/core or @x402/evm. The other
// paymentClient tests mock the whole client, which is exactly why finding #1
// (the local guard checked accepts[0] instead of the accept that would
// actually be signed) was invisible to the suite. This test exercises the
// real x402Client.setSpendControls enforcement end to end.
afterEach(() => {
  vi.unstubAllGlobals();
});

function encode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

// A syntactically valid but unfunded/unused test key. No signing or
// broadcast is ever reached: spend controls reject before a payload for any
// accept is built.
const TEST_PRIVATE_KEY = "0x73637e3a533653a8f5224648d135d5bb5f43b4c66cdb5bba828e64f621135c09";

describe("createPaidFetch real spend-control enforcement", () => {
  it("refuses the expensive mainnet accept even though a cheap testnet accept is listed first", async () => {
    // A seller lists a cheap testnet option first and an expensive mainnet
    // option second. The buyer is registered for mainnet only (real Base USDC
    // addresses so the client's default-asset table recognizes both).
    const challengeHeader = encode({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:84532",
          amount: "1000", // $0.001 on testnet — not the buyer's registered network
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          payTo: "0xSeller",
        },
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "900000", // $0.90 on mainnet — this is what would actually be signed
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: "0xSeller",
        },
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", { status: 402, headers: { "payment-required": challengeHeader } }),
      ),
    );

    const paidFetch = createPaidFetch(TEST_PRIVATE_KEY, "eip155:8453", 0.1);

    // Old behavior (guard checking accepts[0] = $0.001 testnet) would have
    // let this through and signed $0.90. The real fix must reject here.
    await expect(paidFetch("https://seller.example.com/v1/package-trust")).rejects.toThrow(
      /spendcontrols/i,
    );
  });

  it("allows payload creation to proceed when the registered-network accept is within the guard", async () => {
    const challengeHeader = encode({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "50000", // $0.05 — within a $0.10 guard
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: "0xSeller",
        },
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", { status: 402, headers: { "payment-required": challengeHeader } }),
      ),
    );

    const paidFetch = createPaidFetch(TEST_PRIVATE_KEY, "eip155:8453", 0.1);

    // It will still fail eventually (no real signing context / broadcast
    // against a fake seller), but it must get PAST spend controls — i.e. the
    // failure must not be a spendControls rejection.
    let caught: unknown;
    try {
      await paidFetch("https://seller.example.com/v1/package-trust");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    expect(String(caught)).not.toMatch(/spendcontrols/i);
  });
});
