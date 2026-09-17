import { describe, expect, it } from "vitest";
import { caip2ToChainId, DEFAULT_NETWORK, TESTNET_NETWORK } from "./network.js";

describe("caip2ToChainId", () => {
  it("resolves Base mainnet", () => {
    expect(caip2ToChainId("eip155:8453")).toBe(8453);
  });

  it("resolves Base Sepolia", () => {
    expect(caip2ToChainId("eip155:84532")).toBe(84532);
  });

  it("throws on an unsupported network id", () => {
    expect(() => caip2ToChainId("eip155:1")).toThrow(/unsupported network/i);
  });

  it("throws on a malformed CAIP-2 string", () => {
    expect(() => caip2ToChainId("not-a-caip2-id")).toThrow();
  });
});

describe("defaults", () => {
  it("defaults to Base mainnet", () => {
    expect(DEFAULT_NETWORK).toBe("eip155:8453");
  });

  it("documents the Base Sepolia testnet id", () => {
    expect(TESTNET_NETWORK).toBe("eip155:84532");
  });
});
