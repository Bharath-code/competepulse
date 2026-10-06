import {
  diffChangelog,
  diffPricing,
  isChangelogSnapshot,
  isPricingSnapshot,
  planLimits,
  type ExtractSnapshot,
} from "@competepulse/core";
import { getStore } from "./get-store.js";
import type { CrawlJob } from "./queue.js";
import { memorySnapshots, snapshotPublicPath, snapshotR2Key, type SnapshotBucket } from "./r2.js";
import { scrape } from "./scrape.js";
import {
  contentHash,
  type CrawlRun,
  type Snapshot,
  type Store,
  type StoredChange,
  type Watch,
} from "./store.js";

export interface CrawlDeps {
  data?: Store;
  bucket?: SnapshotBucket;
  apiKey?: string;
  /** Fixture scrapes (ENVIRONMENT=local only); never reaches prod storage. */
  allowFixtures?: boolean;
}

export interface CrawlOutcome {
  run: CrawlRun;
  snapshot: Snapshot;
  change: StoredChange;
  provider: string;
  snapshotUrl: string;
}

export interface Observation {
  extracted: ExtractSnapshot;
  markdown: string;
  provider: "mock" | "firecrawl" | "browser";
  crawlRunId: string | null;
  usageMetric: "crawl" | "browser";
  usageQuantity: number;
  costCents: number;
}

/**
 * Persist one observation of a watch: R2 snapshot → snapshot row → diff →
 * change event → usage. The snapshot is always written before its change
 * event, so a digest never sees a change without its snapshot (audit #6).
 * Shared by the polling path and the Monitor webhook consumer.
 */
export async function ingestObservation(
  watch: Watch,
  obs: Observation,
  deps: { data: Store; bucket: SnapshotBucket },
): Promise<{ snapshot: Snapshot; change: StoredChange; snapshotUrl: string }> {
  const { data, bucket } = deps;
  const createdAt = new Date().toISOString();
  const hash = contentHash(obs.extracted);
  const previous = await data.latestSnapshot(watch.id);

  const usage = () =>
    data.recordUsage({
      workspaceId: watch.workspaceId,
      metric: obs.usageMetric,
      quantity: obs.usageQuantity,
      costCents: obs.costCents,
      at: createdAt,
      meta: watch.id,
    });

  // Dedupe: identical content hash → reuse latest snapshot row (B4).
  // Still meter the attempt — COGS was spent even if content was unchanged.
  if (previous && previous.contentHash === hash) {
    await usage();
    const noopChange: StoredChange = {
      id: crypto.randomUUID(),
      watchId: watch.id,
      materiality: "none",
      summary: "No content change (identical hash).",
      findings: [],
      citations: [watch.url],
      fromSnapshotId: previous.id,
      toSnapshotId: previous.id,
      createdAt,
    };
    await data.addChange(noopChange);
    return {
      snapshot: previous,
      change: noopChange,
      snapshotUrl: snapshotPublicPath(previous.r2Key),
    };
  }

  const r2Key = snapshotR2Key(watch.id, createdAt, hash);
  await bucket.put(
    r2Key,
    JSON.stringify({
      url: watch.url,
      markdown: obs.markdown,
      extracted: obs.extracted,
      provider: obs.provider,
      contentHash: hash,
      createdAt,
    }),
  );

  const snapshot: Snapshot = {
    id: crypto.randomUUID(),
    watchId: watch.id,
    crawlRunId: obs.crawlRunId,
    contentHash: hash,
    r2Key,
    extracted: obs.extracted,
    markdown: obs.markdown,
    createdAt,
  };
  await data.addSnapshot(snapshot);

  const change: StoredChange = {
    ...classify(previous?.extracted ?? null, obs.extracted, watch.url),
    id: crypto.randomUUID(),
    watchId: watch.id,
    fromSnapshotId: previous?.id,
    toSnapshotId: snapshot.id,
    createdAt,
  };
  await data.addChange(change);
  await usage();

  return { snapshot, change, snapshotUrl: snapshotPublicPath(r2Key) };
}

/**
 * Process one crawl job: scrape → ingest. Manual/on-demand path; scheduled
 * fan-out is gone (E1-6), Monitor webhooks feed {@link ingestObservation}.
 */
export async function processCrawlJob(job: CrawlJob, deps: CrawlDeps = {}): Promise<CrawlOutcome> {
  const data = deps.data ?? getStore();
  const bucket = deps.bucket ?? memorySnapshots;
  const watch = await data.getWatch(job.watchId);
  if (!watch) throw new Error(`fatal: watch ${job.watchId} not found`);

  const workspace = await data.getWorkspace(watch.workspaceId);
  const limits = planLimits(workspace?.plan ?? "starter");

  const run: CrawlRun = {
    id: crypto.randomUUID(),
    watchId: watch.id,
    workspaceId: watch.workspaceId,
    status: "running",
    provider: null,
    attempt: job.attempt,
    error: null,
    costCents: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  await data.addCrawlRun(run);
  await data.touchWatch(watch.id, false);

  try {
    const result = await scrape(watch.url, {
      apiKey: deps.apiKey,
      allowFixtures: deps.allowFixtures,
      fixture: job.fixture,
      label: watch.label,
    });
    const isBrowser = result.provider === "browser";
    const costCents = isBrowser ? limits.browserCostCents : limits.crawlCostCents;

    const { snapshot, change, snapshotUrl } = await ingestObservation(
      watch,
      {
        extracted: result.extracted,
        markdown: result.markdown,
        provider: result.provider,
        crawlRunId: run.id,
        usageMetric: isBrowser ? "browser" : "crawl",
        usageQuantity: 1,
        costCents,
      },
      { data, bucket },
    );

    const finished: CrawlRun = {
      ...run,
      status: "succeeded",
      provider: result.provider,
      costCents,
      finishedAt: new Date().toISOString(),
    };
    await data.updateCrawlRun(finished);
    await data.touchWatch(watch.id, true);

    return { run: finished, snapshot, change, provider: result.provider, snapshotUrl };
  } catch (err) {
    const finished: CrawlRun = {
      ...run,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      finishedAt: new Date().toISOString(),
    };
    await data.updateCrawlRun(finished);
    throw err;
  }
}

function classify(from: ExtractSnapshot | null, to: ExtractSnapshot, url: string) {
  if (isPricingSnapshot(to)) {
    const prev = from && isPricingSnapshot(from) ? from : null;
    return diffPricing(prev, to, url);
  }
  if (isChangelogSnapshot(to)) {
    const prev = from && isChangelogSnapshot(from) ? from : null;
    return diffChangelog(prev, to, url);
  }
  return {
    materiality: "none" as const,
    summary: "Unsupported extract shape.",
    findings: [],
    citations: [url],
  };
}
