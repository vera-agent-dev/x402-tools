import type { CatalogEntry } from "./catalog.js";

/**
 * Static fallback copy of the seller API's public catalog, used only when
 * X402_BASE_URL is unreachable at startup. Mirrors the public contract
 * documented by the seller (prices/schemas may drift from live data — that's
 * exactly why callers are told this is a fallback, not the source of truth).
 */
export const BUNDLED_CATALOG: CatalogEntry[] = [
  {
    id: "package-trust",
    path: "/v1/package-trust",
    price_usd: 0.05,
    description:
      "Install-safety signals for an npm or PyPI package: registry metadata, install-script usage, OSV advisories, typosquat risk, and a 0-100 trust score.",
    input_schema: {
      type: "object",
      properties: {
        ecosystem: { type: "string", enum: ["npm", "pypi"] },
        name: { type: "string", description: "Package name" },
      },
      required: ["ecosystem", "name"],
    },
    output_schema: { type: "object", properties: {} },
  },
  {
    id: "repo-merge",
    path: "/v1/repo-merge",
    price_usd: 0.05,
    description:
      "Predicts whether a GitHub repository will merge an AI-authored or external pull request, based on its stated AI/contribution policy and historical merge rates.",
    input_schema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/name, e.g. facebook/react" },
      },
      required: ["repo"],
    },
    output_schema: { type: "object", properties: {} },
  },
  {
    id: "a11y-audit",
    path: "/v1/a11y-audit",
    price_usd: 0.08,
    description:
      "WCAG accessibility audit of a public URL using headless Chromium and axe-core: violation/pass/incomplete counts by impact, per-rule detail, and a 0-100 score.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          maxLength: 2048,
          description: "Public http(s) URL to audit. Private/loopback/link-local hosts are rejected.",
        },
        viewport: { type: "string", enum: ["desktop", "mobile"], default: "desktop" },
        wcag: { type: "string", enum: ["2.1-aa", "2.2-aa"], default: "2.2-aa" },
      },
      required: ["url"],
    },
    output_schema: { type: "object", properties: {} },
  },
  {
    id: "schedule-solve",
    path: "/v1/schedule-solve",
    method: "POST",
    price_usd: 0.3,
    description:
      // Trimmed to <=300 chars for CatalogEntrySchema (the seller's own live
      // description exceeds this — see the discovery note in the PR/report).
      "Solves scheduling/roster problems (class rosters, timetables, shift plans) with OR-Tools CP-SAT: assigns resources to slot demands honoring availability, tags and constraints (no double-booking, max-per-day, min-rest, pairs, max hours). Infeasible inputs name the conflicting constraints.",
    input_schema: {
      type: "object",
      properties: {
        slots: {
          type: "array",
          description: "Time or label slots demands can be assigned to.",
          items: { type: "object" },
        },
        resources: {
          type: "array",
          description: "People/rooms/equipment that can be assigned, with tags and availability.",
          items: { type: "object" },
        },
        demands: {
          type: "array",
          description: "Assignment requirements, each tied to a slot.",
          items: { type: "object" },
        },
        constraints: {
          type: "array",
          description:
            "Optional typed constraints: no_double_booking, max_per_day, min_rest_between, forbid_pair, require_pair, fixed_assignment, max_total_hours.",
          items: { type: "object" },
        },
        objective: {
          type: "string",
          enum: ["balance_load", "maximize_preferences", "minimize_resources"],
          default: "balance_load",
        },
        timeLimitSeconds: { type: "number", default: 5, maximum: 15 },
      },
      required: ["slots", "resources", "demands"],
    },
    output_schema: { type: "object", properties: {} },
  },
  {
    id: "mx-rfc",
    path: "/v1/mx/rfc",
    method: "POST",
    price_usd: 0.03,
    description:
      "Structural validation of a Mexican RFC (sent as a JSON body, not a query param): persona física/moral, embedded date, SAT check digit, plus Article 69-B (EFOS) blacklist status.",
    input_schema: {
      type: "object",
      properties: {
        rfc: { type: "string", description: "RFC to validate, e.g. EKU9003173C9" },
      },
      required: ["rfc"],
    },
    output_schema: { type: "object", properties: {} },
  },
  {
    id: "mx-clabe",
    path: "/v1/mx/clabe",
    method: "POST",
    price_usd: 0.02,
    description:
      "Validates an 18-digit Mexican CLABE (sent as a JSON body, not a query param): check digit, bank identification (Banxico/SPEI catalog), plaza, and account number.",
    input_schema: {
      type: "object",
      properties: {
        clabe: { type: "string", description: "18-digit CLABE" },
      },
      required: ["clabe"],
    },
    output_schema: { type: "object", properties: {} },
  },
  {
    id: "mx-cfdi",
    path: "/v1/mx/cfdi",
    method: "POST",
    price_usd: 0.05,
    description:
      "Verifies a Mexican electronic invoice (CFDI) with SAT (JSON body, not query params): status (vigente/cancelado), cancelability, and EFOS validation. Requires a real CFDI's UUID, issuer and receiver RFCs, and total; the example values are illustrative and return 404 (not charged).",
    input_schema: {
      type: "object",
      properties: {
        uuid: { type: "string", description: "CFDI UUID (8-4-4-4-12 hex; not necessarily UUID v4)" },
        rfcEmisor: { type: "string" },
        rfcReceptor: { type: "string" },
        total: { type: "string", description: "CFDI total, as a decimal string" },
      },
      required: ["uuid", "rfcEmisor", "rfcReceptor", "total"],
    },
    output_schema: { type: "object", properties: {} },
  },
];
