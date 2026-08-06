import type { ExtractSnapshot, PricingSnapshot, WatchLabel } from "@competepulse/core";
import { FIXTURES, type ScrapeResult } from "./scrape.js";

/**
 * Cloudflare Browser Run fallback (E2-5). When Firecrawl returns a thin body
 * (< N chars), we re-fetch via a headless browser path. Locally this uses the
 * same deterministic fixtures so tests stay hermetic.
 */
export interface BrowserRunOptions {
  url: string;
  label: WatchLabel;
  fixture?: string;
  /** Injected for tests; production would call CF Browser Rendering. */
  fetchPage?: (url: string) => Promise<{ markdown: string; extracted: ExtractSnapshot }>;
}

export async function browserRunFallback(opts: BrowserRunOptions): Promise<ScrapeResult> {
  if (opts.fetchPage) {
    const page = await opts.fetchPage(opts.url);
    return {
      url: opts.url,
      markdown: page.markdown,
      extracted: page.extracted,
      provider: "browser",
      thin: false,
    };
  }

  const fixtureKey = opts.fixture ?? "acme_v1";
  const extracted: PricingSnapshot = FIXTURES[fixtureKey] ?? FIXTURES.acme_v1;
  const markdown = [
    `# Browser-rendered ${opts.url}`,
    "",
    JSON.stringify(extracted, null, 2),
    "",
    "<!-- rendered via browser fallback -->",
  ].join("\n");

  return {
    url: opts.url,
    markdown,
    extracted,
    provider: "browser",
    thin: false,
  };
}
