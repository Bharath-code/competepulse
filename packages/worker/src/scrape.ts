import type { PricingSnapshot } from "@competepulse/core";

export interface ScrapeResult {
  url: string;
  extracted: PricingSnapshot;
  provider: "mock" | "firecrawl";
}

/**
 * Deterministic mock fixtures used when no Firecrawl API key is configured.
 * `acme_v1` is a baseline pricing page; `acme_v2` simulates a material change
 * (Pro price hike + SSO added), which lets the crawl→diff pipeline be
 * demonstrated end-to-end locally without any secrets.
 */
export const FIXTURES: Record<string, PricingSnapshot> = {
  acme_v1: {
    currency: "USD",
    plans: [
      { name: "Starter", price_monthly: 49, price_annual: 39, unit: "seat" },
      { name: "Pro", price_monthly: 99, price_annual: 79, unit: "seat" },
    ],
    features_called_out: ["Analytics", "Integrations"],
    free_trial_days: 14,
    notes: [],
  },
  acme_v2: {
    currency: "USD",
    plans: [
      { name: "Starter", price_monthly: 49, price_annual: 39, unit: "seat" },
      { name: "Pro", price_monthly: 129, price_annual: 99, unit: "seat" },
    ],
    features_called_out: ["Analytics", "Integrations", "SSO"],
    free_trial_days: 14,
    notes: [],
  },
};

const PRICING_EXTRACT_SCHEMA = {
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

async function firecrawlScrape(url: string, apiKey: string): Promise<ScrapeResult> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["json"],
      jsonOptions: { schema: PRICING_EXTRACT_SCHEMA },
    }),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl scrape failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: { json?: PricingSnapshot } };
  const extracted = body.data?.json;
  if (!extracted) {
    throw new Error("Firecrawl returned no structured extraction.");
  }
  return { url, extracted, provider: "firecrawl" };
}

export interface ScrapeOptions {
  apiKey?: string;
  fixture?: string;
}

/**
 * Scrape + structured-extract a URL. Uses the live Firecrawl API when
 * `apiKey` is provided, otherwise returns a deterministic mock fixture.
 */
export async function scrape(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  if (opts.apiKey) {
    return firecrawlScrape(url, opts.apiKey);
  }
  const fixtureKey = opts.fixture ?? "acme_v1";
  const extracted = FIXTURES[fixtureKey] ?? FIXTURES.acme_v1;
  return { url, extracted, provider: "mock" };
}
