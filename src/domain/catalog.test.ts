import { describe, expect, it } from "vitest";
import {
  describeToolWithPrice,
  findProduct,
  jsonSchemaToZodShape,
  validateCatalog,
  type CatalogEntry,
} from "./catalog.js";

const packageTrust: CatalogEntry = {
  id: "package-trust",
  path: "/v1/package-trust",
  price_usd: 0.05,
  description: "Install-safety signals for an npm or PyPI package.",
  input_schema: {
    type: "object",
    properties: {
      ecosystem: { type: "string", enum: ["npm", "pypi"] },
      name: { type: "string", description: "Package name" },
    },
    required: ["ecosystem", "name"],
  },
  output_schema: { type: "object", properties: {} },
};

describe("findProduct", () => {
  it("finds a product by id", () => {
    expect(findProduct([packageTrust], "package-trust")).toBe(packageTrust);
  });

  it("returns undefined for an unknown id", () => {
    expect(findProduct([packageTrust], "nope")).toBeUndefined();
  });
});

describe("describeToolWithPrice", () => {
  it("appends the live price to the description", () => {
    const text = describeToolWithPrice(packageTrust);
    expect(text).toContain("Install-safety signals");
    expect(text).toContain("$0.05 USDC");
  });
});

describe("jsonSchemaToZodShape", () => {
  it("converts string+enum and plain string properties, marking required fields", () => {
    const shape = jsonSchemaToZodShape(packageTrust.input_schema);

    expect(shape.ecosystem.safeParse("npm").success).toBe(true);
    expect(shape.ecosystem.safeParse("cargo").success).toBe(false);

    expect(shape.name.safeParse("left-pad").success).toBe(true);
    expect(shape.name.safeParse(42).success).toBe(false);
  });

  it("marks properties not in required[] as optional", () => {
    const shape = jsonSchemaToZodShape({
      type: "object",
      properties: { repo: { type: "string" }, extra: { type: "string" } },
      required: ["repo"],
    });

    expect(shape.repo.safeParse(undefined).success).toBe(false);
    expect(shape.extra.safeParse(undefined).success).toBe(true);
  });
});

describe("validateCatalog", () => {
  it("accepts a well-formed catalog and strips control characters from descriptions", () => {
    const entries = validateCatalog([
      { ...packageTrust, description: "Safe description" },
    ]);
    expect(entries[0].description).toBe("Safe description");
  });

  it("rejects a negative price_usd", () => {
    expect(() => validateCatalog([{ ...packageTrust, price_usd: -0.05 }])).toThrow();
  });

  it("rejects a non-numeric price_usd", () => {
    expect(() =>
      validateCatalog([{ ...packageTrust, price_usd: "0.05" as unknown as number }]),
    ).toThrow();
  });

  it("rejects a description longer than 300 characters", () => {
    expect(() =>
      validateCatalog([{ ...packageTrust, description: "x".repeat(301) }]),
    ).toThrow();
  });

  it("rejects an entry missing id or path", () => {
    const { id: _id, ...withoutId } = packageTrust;
    expect(() => validateCatalog([withoutId as unknown as CatalogEntry])).toThrow();
  });

  it("rejects a non-array payload", () => {
    expect(() => validateCatalog({ not: "an array" })).toThrow();
  });

  it("rejects when input_schema/output_schema are not objects", () => {
    expect(() =>
      validateCatalog([{ ...packageTrust, input_schema: "nope" as unknown as CatalogEntry["input_schema"] }]),
    ).toThrow();
  });
});
