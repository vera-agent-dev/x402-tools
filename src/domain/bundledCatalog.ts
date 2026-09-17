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
];
