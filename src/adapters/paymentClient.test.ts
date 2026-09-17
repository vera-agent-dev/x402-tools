import { describe, expect, it, vi } from "vitest";

const { wrapFetchWithPayment, registerMock, x402ClientCtor, decodePaymentResponseHeader } =
  vi.hoisted(() => {
    const wrapFetchWithPayment = vi.fn((fetchImpl: typeof fetch) => fetchImpl);
    const registerMock = vi.fn().mockReturnThis();
    const x402ClientCtor = vi.fn().mockImplementation(() => ({ register: registerMock }));
    const decodePaymentResponseHeader = vi.fn().mockReturnValue({
      success: true,
      transaction: "0xdeadbeef",
      network: "eip155:84532",
      payer: "0xBuyer",
    });
    return { wrapFetchWithPayment, registerMock, x402ClientCtor, decodePaymentResponseHeader };
  });

vi.mock("@x402/fetch", () => ({
  x402Client: x402ClientCtor,
  wrapFetchWithPayment,
  decodePaymentResponseHeader,
}));

vi.mock("@x402/evm", () => ({
  ExactEvmScheme: vi.fn(),
  toClientEvmSigner: vi.fn().mockReturnValue({}),
}));

vi.mock("viem", () => ({
  createPublicClient: vi.fn().mockReturnValue({}),
  http: vi.fn(),
}));

vi.mock("viem/chains", () => ({
  base: { id: 8453 },
  baseSepolia: { id: 84532 },
}));

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({ address: "0xBuyer" }),
}));

import { createPaidFetch, decodeSettlement } from "./paymentClient.js";

describe("createPaidFetch", () => {
  it("registers an ExactEvmScheme client for the configured network and wraps fetch", () => {
    const paidFetch = createPaidFetch("0xprivatekey", "eip155:84532");

    expect(x402ClientCtor).toHaveBeenCalled();
    expect(registerMock).toHaveBeenCalledWith("eip155:84532", expect.anything());
    expect(wrapFetchWithPayment).toHaveBeenCalled();
    expect(typeof paidFetch).toBe("function");
  });

  it("throws for a network it does not recognize", () => {
    expect(() => createPaidFetch("0xprivatekey", "eip155:1")).toThrow(/unsupported network/i);
  });
});

describe("decodeSettlement", () => {
  it("decodes the payment-response header into a settlement summary", () => {
    const response = new Response("{}", {
      headers: { "payment-response": "encoded" },
    });

    const settlement = decodeSettlement(response);

    expect(settlement).toEqual({
      success: true,
      transaction: "0xdeadbeef",
      network: "eip155:84532",
      payer: "0xBuyer",
    });
  });

  it("falls back to the legacy X-PAYMENT-RESPONSE header", () => {
    const response = new Response("{}", {
      headers: { "x-payment-response": "encoded" },
    });

    expect(decodeSettlement(response)).not.toBeNull();
  });

  it("returns null when no settlement header is present", () => {
    const response = new Response("{}");
    expect(decodeSettlement(response)).toBeNull();
  });
});
