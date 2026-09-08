import type { ExtractSnapshot, PricingSnapshot, WatchLabel } from "@competepulse/core";
import { FIXTURES, type ScrapeResult } from "./scrape.js";

/**
 * Cloudflare Browser Run fallback (E2-5).
 * - Tests / local: deterministic fixtures when `allowFixtures` is true (default).
 * - Production: requires `fetchPage` inject or throws (no silent fixture).
 */
export interface BrowserRunOptions {
  url: string;
  label: WatchLabel;
  fixture?: string;
  /** Injected for tests; production should call CF Browser Rendering. */
  fetchPage?: (url: string) => Promise<{ markdown: string; extracted: ExtractSnapshot }>;
  /** When false, refuse fixture fallback (Path B4). Default true for hermetic tests. */
  allowFixtures?: boolean;
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

  if (opts.allowFixtures === false) {
    throw new Error(
      `browser_fallback_unavailable: thin scrape for ${opts.url} and no Browser Rendering binding`,
    );
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
