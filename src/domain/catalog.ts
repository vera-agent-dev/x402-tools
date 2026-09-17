import { z } from "zod";

/** Mirrors the public shape of GET /products from the x402-api seller. */
export interface CatalogEntry {
  id: string;
  path: string;
  price_usd: number;
  description: string;
  input_schema: JsonSchemaObject;
  output_schema: JsonSchemaObject;
}

export interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  [key: string]: unknown;
}

export interface JsonSchemaProperty {
  type?: string;
  enum?: string[];
  description?: string;
  [key: string]: unknown;
}

export function findProduct(catalog: CatalogEntry[], id: string): CatalogEntry | undefined {
  return catalog.find((entry) => entry.id === id);
}

/** Appends the live price to a catalog entry's description, for tool metadata. */
export function describeToolWithPrice(entry: CatalogEntry): string {
  return `${entry.description} (price: $${entry.price_usd.toFixed(2)} USDC per call)`;
}

/**
 * Minimal JSON-Schema-object -> Zod raw shape converter. Only supports the
 * property shapes the seller catalog actually uses (string, string+enum);
 * that keeps it honest instead of pretending to be a general converter.
 */
export function jsonSchemaToZodShape(
  schema: JsonSchemaObject,
): Record<string, z.ZodTypeAny> {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, property] of Object.entries(properties)) {
    let zodType: z.ZodTypeAny;

    if (property.type === "string" && property.enum) {
      zodType = z.enum(property.enum as [string, ...string[]]);
    } else if (property.type === "string") {
      zodType = z.string();
    } else {
      // Fallback: accept anything rather than silently dropping the field.
      zodType = z.unknown();
    }

    if (property.description) {
      zodType = zodType.describe(property.description);
    }

    shape[key] = required.has(key) ? zodType : zodType.optional();
  }

  return shape;
}
