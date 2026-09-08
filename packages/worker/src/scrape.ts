import {
  CHANGELOG_EXTRACT_SCHEMA,
  PRICING_EXTRACT_SCHEMA,
  THIN_SCRAPE_CHAR_THRESHOLD,
  type ChangelogSnapshot,
  type ExtractSnapshot,
  type PricingSnapshot,
  type WatchLabel,
} from "@competepulse/core";
import { browserRunFallback } from "./browser.js";

export type ScrapeProvider = "mock" | "firecrawl" | "browser";

export interface ScrapeResult {
  url: string;
  markdown: string;
  extracted: ExtractSnapshot;
  provider: ScrapeProvider;
  thin: boolean;
}

/**
 * Deterministic mock fixtures used when no Firecrawl API key is configured.
 * `acme_v1` is a baseline pricing page; `acme_v2` simulates a material change
 * (Pro price hike + SSO added). `thin_page` forces the Browser Run path (E2-5).
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

export const CHANGELOG_FIXTURES: Record<string, ChangelogSnapshot> = {
  changelog_v1: {
    entries: [{ date: "2026-07-01", title: "Launch analytics", summary: null, tags: ["feature"] }],
    notes: [],
  },
  changelog_v2: {
    entries: [
      { date: "2026-07-01", title: "Launch analytics", summary: null, tags: ["feature"] },
      {
        date: "2026-08-01",
        title: "SSO for all plans",
        summary: "Enterprise SSO",
        tags: ["security"],
      },
    ],
    notes: [],
  },
};

function extractSchemaFor(label: WatchLabel) {
  return label === "changelog" ? CHANGELOG_EXTRACT_SCHEMA : PRICING_EXTRACT_SCHEMA;
}

function mockMarkdown(url: string, extracted: ExtractSnapshot): string {
  return [`# ${url}`, "", "```json", JSON.stringify(extracted, null, 2), "```"].join("\n");
}

async function firecrawlScrape(
  url: string,
  apiKey: string,
  label: WatchLabel,
): Promise<ScrapeResult> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "json"],
      jsonOptions: { schema: extractSchemaFor(label) },
    }),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl scrape failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as {
    data?: { json?: ExtractSnapshot; markdown?: string };
  };
  const extracted = body.data?.json;
  const markdown = body.data?.markdown ?? "";
  if (!extracted) {
    throw new Error("Firecrawl returned no structured extraction.");
  }
  const thin = markdown.trim().length < THIN_SCRAPE_CHAR_THRESHOLD;
  return { url, markdown, extracted, provider: "firecrawl", thin };
}

export interface ScrapeOptions {
  apiKey?: string;
  fixture?: string;
  label?: WatchLabel;
  /** Force Browser Run even when markdown is thick (tests). */
  forceBrowser?: boolean;
  /** When false, thin pages error instead of silent fixture (prod). Default true. */
  allowBrowserFixtures?: boolean;
}

/**
 * Scrape + structured-extract a URL (E2-2). Uses Firecrawl when `apiKey` is
 * set; otherwise returns deterministic fixtures. Thin scrapes fall back to
 * Browser Run (E2-5).
 */
export async function scrape(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  const label = opts.label ?? "pricing";

  let result: ScrapeResult;
  if (opts.apiKey) {
    result = await firecrawlScrape(url, opts.apiKey, label);
  } else if (opts.fixture === "thin_page") {
    result = {
      url,
      markdown: "ok",
      extracted: FIXTURES.acme_v1,
      provider: "mock",
      thin: true,
    };
  } else if (label === "changelog") {
    const key = opts.fixture ?? "changelog_v1";
    const extracted = CHANGELOG_FIXTURES[key] ?? CHANGELOG_FIXTURES.changelog_v1;
    const markdown = mockMarkdown(url, extracted);
    result = { url, markdown, extracted, provider: "mock", thin: false };
  } else {
    const fixtureKey = opts.fixture ?? "acme_v1";
    const extracted = FIXTURES[fixtureKey] ?? FIXTURES.acme_v1;
    const markdown = mockMarkdown(url, extracted);
    result = { url, markdown, extracted, provider: "mock", thin: false };
  }

  if (result.thin || opts.forceBrowser) {
    return browserRunFallback({
      url,
      label,
      fixture: opts.fixture === "thin_page" ? "acme_v1" : opts.fixture,
      allowFixtures: opts.allowBrowserFixtures !== false,
    });
  }
  return result;
}
