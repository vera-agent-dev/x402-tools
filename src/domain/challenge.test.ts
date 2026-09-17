import { describe, expect, it } from "vitest";
import {
  decodeChallenge,
  formatChallengeMessage,
  isWithinSpendingGuard,
} from "./challenge.js";

function encode(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

describe("decodeChallenge", () => {
  it("decodes a base64 payment-required header into a plain summary", () => {
    const header = encode({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:84532",
          amount: "50000",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          payTo: "0xSeller",
        },
      ],
    });

    const challenge = decodeChallenge(header);

    expect(challenge.scheme).toBe("exact");
    expect(challenge.network).toBe("eip155:84532");
    expect(challenge.asset).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    expect(challenge.payTo).toBe("0xSeller");
    expect(challenge.amountRaw).toBe("50000");
    // USDC has 6 decimals; 50000 raw units == $0.05
    expect(challenge.amountUsd).toBeCloseTo(0.05, 6);
  });

  it("throws a clear error when there are no accepted payment options", () => {
    const header = encode({ x402Version: 2, accepts: [] });
    expect(() => decodeChallenge(header)).toThrow(/no accepted payment/i);
  });

  it("throws a clear error on invalid base64/JSON", () => {
    expect(() => decodeChallenge("not-base64-json")).toThrow();
  });
});

describe("isWithinSpendingGuard", () => {
  it("allows an amount at or below the max", () => {
    expect(isWithinSpendingGuard(0.05, 0.1)).toBe(true);
    expect(isWithinSpendingGuard(0.1, 0.1)).toBe(true);
  });

  it("refuses an amount above the max", () => {
    expect(isWithinSpendingGuard(0.11, 0.1)).toBe(false);
  });
});

describe("formatChallengeMessage", () => {
  it("mentions the amount, asset, network and how to pay via env var", () => {
    const challenge = decodeChallenge(
      encode({
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:84532",
            amount: "50000",
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            payTo: "0xSeller",
          },
        ],
      }),
    );

    const message = formatChallengeMessage(challenge);

    expect(message).toContain("$0.05");
    expect(message).toContain("eip155:84532");
    expect(message).toContain("X402_BUYER_PRIVATE_KEY");
  });

  it("explains a guard refusal when the amount exceeds the configured max", () => {
    const challenge = decodeChallenge(
      encode({
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            amount: "5000000",
            asset: "0xUSDC",
            payTo: "0xSeller",
          },
        ],
      }),
    );

    const message = formatChallengeMessage(challenge, { guardExceeded: true, maxUsd: 0.1 });

    expect(message).toContain("exceeds");
    expect(message).toContain("0.1");
  });
});
