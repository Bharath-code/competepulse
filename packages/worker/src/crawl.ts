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
} from "./store.js";

export interface CrawlDeps {
  data?: Store;
  bucket?: SnapshotBucket;
  apiKey?: string;
  /** When true and bucket is memory-only, allow fixture scrapes without R2. */
  allowMemorySnapshots?: boolean;
}

export interface CrawlOutcome {
  run: CrawlRun;
  snapshot: Snapshot;
  change: StoredChange;
  provider: string;
  snapshotUrl: string;
}

/**
 * Process one crawl job: scrape → R2 snapshot → diff → usage ledger.
 * Shared by the sync HTTP path and the queue consumer (E2-1…E2-5, E5-3).
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
      fixture: job.fixture,
      label: watch.label,
    });

    const createdAt = new Date().toISOString();
    const hash = contentHash(result.extracted);

    // Dedupe: identical content hash → reuse latest snapshot row (B4).
    // Still meter the scrape attempt — COGS was spent even if content was unchanged.
    const previous = await data.latestSnapshot(watch.id);
    if (previous && previous.contentHash === hash) {
      const costCents =
        result.provider === "browser" ? limits.browserCostCents : limits.crawlCostCents;
      const finished: CrawlRun = {
        ...run,
        status: "succeeded",
        provider: result.provider,
        costCents,
        finishedAt: createdAt,
      };
      await data.updateCrawlRun(finished);
      await data.touchWatch(watch.id, true);
      await data.recordUsage({
        workspaceId: watch.workspaceId,
        metric: result.provider === "browser" ? "browser" : "crawl",
        quantity: 1,
        costCents,
        at: createdAt,
        meta: watch.id,
      });
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
        run: finished,
        snapshot: previous,
        change: noopChange,
        provider: result.provider,
        snapshotUrl: snapshotPublicPath(previous.r2Key),
      };
    }

    const r2Key = snapshotR2Key(watch.id, createdAt, hash);
    const payload = JSON.stringify({
      url: watch.url,
      markdown: result.markdown,
      extracted: result.extracted,
      provider: result.provider,
      contentHash: hash,
      createdAt,
    });
    await bucket.put(r2Key, payload);

    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      watchId: watch.id,
      crawlRunId: run.id,
      contentHash: hash,
      r2Key,
      extracted: result.extracted,
      markdown: result.markdown,
      createdAt,
    };
    await data.addSnapshot(snapshot);

    const event = classify(previous?.extracted ?? null, result.extracted, watch.url);
    const change: StoredChange = {
      ...event,
      id: crypto.randomUUID(),
      watchId: watch.id,
      fromSnapshotId: previous?.id,
      toSnapshotId: snapshot.id,
      createdAt,
    };
    await data.addChange(change);

    const costCents =
      result.provider === "browser" ? limits.browserCostCents : limits.crawlCostCents;
    const finished: CrawlRun = {
      ...run,
      status: "succeeded",
      provider: result.provider,
      costCents,
      finishedAt: createdAt,
    };
    await data.updateCrawlRun(finished);
    await data.touchWatch(watch.id, true);
    await data.recordUsage({
      workspaceId: watch.workspaceId,
      metric: result.provider === "browser" ? "browser" : "crawl",
      quantity: 1,
      costCents,
      at: createdAt,
      meta: watch.id,
    });

    return {
      run: finished,
      snapshot,
      change,
      provider: result.provider,
      snapshotUrl: snapshotPublicPath(r2Key),
    };
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
