/**
 * Structured extract schemas for Firecrawl JSON mode (PRD §13 / E2-2).
 * Kept as plain objects so they can be serialized into API requests.
 */

export const PRICING_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    currency: { type: "string" },
    plans: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price_monthly: { type: ["number", "null"] },
          price_annual: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
        },
      },
    },
    features_called_out: { type: "array", items: { type: "string" } },
    free_trial_days: { type: ["number", "null"] },
    notes: { type: "array", items: { type: "string" } },
  },
} as const;

export const CHANGELOG_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: ["string", "null"] },
          title: { type: "string" },
          summary: { type: ["string", "null"] },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title"],
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["entries"],
} as const;

/** Characters below which a scrape is considered "thin" and Browser Run is used (E2-5). */
export const THIN_SCRAPE_CHAR_THRESHOLD = 200;
