import { describe, expect, it } from "vitest";
import { parseEnv, parseMaxPriceUsd } from "./env.js";

describe("parseMaxPriceUsd", () => {
  it("defaults to 0.10 when unset", () => {
    expect(parseMaxPriceUsd(undefined)).toBe(0.1);
  });

  it("defaults to 0.10 for an empty string", () => {
    expect(parseMaxPriceUsd("")).toBe(0.1);
    expect(parseMaxPriceUsd("   ")).toBe(0.1);
  });

  it("parses a valid positive number", () => {
    expect(parseMaxPriceUsd("0.25")).toBe(0.25);
  });

  it("throws a clear error for a non-numeric value", () => {
    expect(() => parseMaxPriceUsd("abc")).toThrow(/X402_MAX_PRICE_USD/);
  });

  it("throws a clear error for zero or a negative value", () => {
    expect(() => parseMaxPriceUsd("0")).toThrow(/X402_MAX_PRICE_USD/);
    expect(() => parseMaxPriceUsd("-1")).toThrow(/X402_MAX_PRICE_USD/);
  });
});

describe("parseEnv", () => {
  it("applies defaults when nothing is set", () => {
    const config = parseEnv({});
    expect(config.baseUrl).toBe("https://x402-api-24223879872.us-east1.run.app");
    expect(config.network).toBe("eip155:8453");
    expect(config.maxPriceUsd).toBe(0.1);
    expect(config.buyerPrivateKey).toBeUndefined();
  });

  it("reads all variables when set", () => {
    const config = parseEnv({
      X402_BASE_URL: "http://localhost:3000",
      X402_BUYER_PRIVATE_KEY: "0xabc",
      X402_NETWORK: "eip155:84532",
      X402_MAX_PRICE_USD: "0.5",
    });
    expect(config).toEqual({
      baseUrl: "http://localhost:3000",
      buyerPrivateKey: "0xabc",
      network: "eip155:84532",
      maxPriceUsd: 0.5,
    });
  });

  it("fails clearly on a malformed X402_BASE_URL", () => {
    expect(() => parseEnv({ X402_BASE_URL: "not a url" })).toThrow(/X402_BASE_URL/);
  });

  it("fails clearly on an unsupported X402_NETWORK", () => {
    expect(() => parseEnv({ X402_NETWORK: "eip155:1" })).toThrow(/unsupported network/i);
  });

  it("fails clearly on an invalid X402_MAX_PRICE_USD", () => {
    expect(() => parseEnv({ X402_MAX_PRICE_USD: "abc" })).toThrow(/X402_MAX_PRICE_USD/);
  });
});
