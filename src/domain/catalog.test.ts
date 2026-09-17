import { describe, expect, it } from "vitest";
import {
  describeToolWithPrice,
  findProduct,
  jsonSchemaToZodShape,
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
