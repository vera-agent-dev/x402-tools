import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOG } from "./bundledCatalog.js";
import { validateCatalog } from "./catalog.js";

describe("BUNDLED_CATALOG", () => {
  it("passes the same schema validation applied to the live catalog", () => {
    expect(() => validateCatalog(BUNDLED_CATALOG)).not.toThrow();
  });

  it("mirrors every paid route the seller currently exposes", () => {
    const ids = BUNDLED_CATALOG.map((entry) => entry.id).sort();
    expect(ids).toEqual(["a11y-audit", "package-trust", "repo-merge"]);
  });

  it("carries the a11y-audit contract: GET /v1/a11y-audit at $0.08 with url required", () => {
    const entry = BUNDLED_CATALOG.find((e) => e.id === "a11y-audit");
    expect(entry).toBeDefined();
    expect(entry?.path).toBe("/v1/a11y-audit");
    expect(entry?.price_usd).toBe(0.08);
    expect(entry?.input_schema.required).toEqual(["url"]);
    expect(Object.keys(entry?.input_schema.properties ?? {})).toEqual(["url", "viewport", "wcag"]);
  });
});
