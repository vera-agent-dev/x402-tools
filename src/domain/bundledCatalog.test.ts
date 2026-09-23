import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOG } from "./bundledCatalog.js";
import { validateCatalog } from "./catalog.js";

describe("BUNDLED_CATALOG", () => {
  it("passes the same schema validation applied to the live catalog", () => {
    expect(() => validateCatalog(BUNDLED_CATALOG)).not.toThrow();
  });

  it("mirrors every paid route the seller currently exposes", () => {
    const ids = BUNDLED_CATALOG.map((entry) => entry.id).sort();
    expect(ids).toEqual([
      "a11y-audit",
      "mx-cfdi",
      "mx-clabe",
      "mx-rfc",
      "package-trust",
      "repo-merge",
      "schedule-solve",
    ]);
  });

  it("carries the a11y-audit contract: GET /v1/a11y-audit at $0.08 with url required", () => {
    const entry = BUNDLED_CATALOG.find((e) => e.id === "a11y-audit");
    expect(entry).toBeDefined();
    expect(entry?.path).toBe("/v1/a11y-audit");
    expect(entry?.price_usd).toBe(0.08);
    expect(entry?.input_schema.required).toEqual(["url"]);
    expect(Object.keys(entry?.input_schema.properties ?? {})).toEqual(["url", "viewport", "wcag"]);
  });

  it("carries the schedule-solve contract: POST /v1/schedule-solve at $0.30 with slots/resources/demands required", () => {
    const entry = BUNDLED_CATALOG.find((e) => e.id === "schedule-solve");
    expect(entry).toBeDefined();
    expect(entry?.method).toBe("POST");
    expect(entry?.path).toBe("/v1/schedule-solve");
    expect(entry?.price_usd).toBe(0.3);
    expect(entry?.input_schema.required).toEqual(["slots", "resources", "demands"]);
  });

  it("carries the mx-rfc contract: GET /v1/mx/rfc at $0.03 with rfc required", () => {
    const entry = BUNDLED_CATALOG.find((e) => e.id === "mx-rfc");
    expect(entry).toBeDefined();
    expect(entry?.method).toBeUndefined();
    expect(entry?.path).toBe("/v1/mx/rfc");
    expect(entry?.price_usd).toBe(0.03);
    expect(entry?.input_schema.required).toEqual(["rfc"]);
  });

  it("carries the mx-clabe contract: GET /v1/mx/clabe at $0.02 with clabe required", () => {
    const entry = BUNDLED_CATALOG.find((e) => e.id === "mx-clabe");
    expect(entry).toBeDefined();
    expect(entry?.path).toBe("/v1/mx/clabe");
    expect(entry?.price_usd).toBe(0.02);
    expect(entry?.input_schema.required).toEqual(["clabe"]);
  });

  it("carries the mx-cfdi contract: GET /v1/mx/cfdi at $0.05 with uuid/rfcEmisor/rfcReceptor/total required", () => {
    const entry = BUNDLED_CATALOG.find((e) => e.id === "mx-cfdi");
    expect(entry).toBeDefined();
    expect(entry?.path).toBe("/v1/mx/cfdi");
    expect(entry?.price_usd).toBe(0.05);
    expect(entry?.input_schema.required).toEqual(["uuid", "rfcEmisor", "rfcReceptor", "total"]);
  });
});
