import { describe, expect, it, vi } from "vitest";
import { callPaidTool, type PaidToolDeps } from "./paidTool.js";
import type { CatalogEntry } from "../domain/catalog.js";

const entry: CatalogEntry = {
  id: "package-trust",
  path: "/v1/package-trust",
  price_usd: 0.05,
  description: "Install-safety signals",
  input_schema: { type: "object", properties: {} },
  output_schema: { type: "object", properties: {} },
};

function encode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

const challengeHeader = encode({
  x402Version: 2,
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      amount: "50000",
      asset: "0xUSDC",
      payTo: "0xSeller",
    },
  ],
});

describe("callPaidTool", () => {
  it("returns the JSON result directly when the server does not require payment (e.g. FREE_MODE)", async () => {
    const fetchProduct = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ score: 90 }), { status: 200 }));
    const deps: PaidToolDeps = {
      fetchProduct,
      createPaidFetch: vi.fn(),
      decodeSettlement: vi.fn(),
    };

    const result = await callPaidTool(
      entry,
      { ecosystem: "npm", name: "left-pad" },
      { baseUrl: "https://api.example.com", network: "eip155:84532", maxPriceUsd: 0.1 },
      deps,
    );

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("90");
  });

  it("returns the decoded challenge, unpaid, when no private key is configured", async () => {
    const fetchProduct = vi.fn().mockResolvedValue(
      new Response("{}", { status: 402, headers: { "payment-required": challengeHeader } }),
    );
    const deps: PaidToolDeps = {
      fetchProduct,
      createPaidFetch: vi.fn(),
      decodeSettlement: vi.fn(),
    };

    const result = await callPaidTool(
      entry,
      { ecosystem: "npm", name: "left-pad" },
      { baseUrl: "https://api.example.com", network: "eip155:84532", maxPriceUsd: 0.1 },
      deps,
    );

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("$0.05");
    expect(result.content[0].text).toContain("X402_BUYER_PRIVATE_KEY");
    expect(deps.createPaidFetch).not.toHaveBeenCalled();
  });

  it("refuses to pay and returns the challenge when the amount exceeds the spending guard", async () => {
    const fetchProduct = vi.fn().mockResolvedValue(
      new Response("{}", { status: 402, headers: { "payment-required": challengeHeader } }),
    );
    const deps: PaidToolDeps = {
      fetchProduct,
      createPaidFetch: vi.fn(),
      decodeSettlement: vi.fn(),
    };

    const result = await callPaidTool(
      entry,
      { ecosystem: "npm", name: "left-pad" },
      {
        baseUrl: "https://api.example.com",
        buyerPrivateKey: "0xkey",
        network: "eip155:84532",
        maxPriceUsd: 0.01,
      },
      deps,
    );

    expect(result.content[0].text).toContain("exceeds");
    expect(deps.createPaidFetch).not.toHaveBeenCalled();
  });

  it("pays automatically and returns the result plus a payment block when a key is set and within guard", async () => {
    const unpaidResponse = new Response("{}", {
      status: 402,
      headers: { "payment-required": challengeHeader },
    });
    const paidResponse = new Response(JSON.stringify({ score: 90 }), {
      status: 200,
      headers: { "payment-response": "encoded-settlement" },
    });

    const fetchProduct = vi
      .fn()
      .mockResolvedValueOnce(unpaidResponse)
      .mockResolvedValueOnce(paidResponse);
    const paidFetchImpl = vi.fn();
    const deps: PaidToolDeps = {
      fetchProduct,
      createPaidFetch: vi.fn().mockReturnValue(paidFetchImpl),
      decodeSettlement: vi.fn().mockReturnValue({
        success: true,
        transaction: "0xdeadbeef",
        network: "eip155:84532",
        payer: "0xBuyer",
      }),
    };

    const result = await callPaidTool(
      entry,
      { ecosystem: "npm", name: "left-pad" },
      {
        baseUrl: "https://api.example.com",
        buyerPrivateKey: "0xkey",
        network: "eip155:84532",
        maxPriceUsd: 0.1,
      },
      deps,
    );

    expect(deps.createPaidFetch).toHaveBeenCalledWith("0xkey", "eip155:84532");
    expect(fetchProduct).toHaveBeenCalledTimes(2);
    expect(fetchProduct).toHaveBeenLastCalledWith(
      "https://api.example.com",
      "/v1/package-trust",
      { ecosystem: "npm", name: "left-pad" },
      paidFetchImpl,
    );
    expect(result.content[0].text).toContain("90");
    expect(result.content[0].text).toContain("0xdeadbeef");
    expect(result.content[0].text).toContain("eip155:84532");
  });

  it("returns an error result when the paid retry itself fails", async () => {
    const fetchProduct = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{}", { status: 402, headers: { "payment-required": challengeHeader } }),
      )
      .mockResolvedValueOnce(new Response("server error", { status: 500 }));
    const deps: PaidToolDeps = {
      fetchProduct,
      createPaidFetch: vi.fn().mockReturnValue(vi.fn()),
      decodeSettlement: vi.fn(),
    };

    const result = await callPaidTool(
      entry,
      { ecosystem: "npm", name: "left-pad" },
      {
        baseUrl: "https://api.example.com",
        buyerPrivateKey: "0xkey",
        network: "eip155:84532",
        maxPriceUsd: 0.1,
      },
      deps,
    );

    expect(result.isError).toBe(true);
  });
});
