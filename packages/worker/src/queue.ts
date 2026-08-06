/**
 * Crawl queue with retries + exponential backoff (E2-1).
 *
 * In production the Worker binds a Cloudflare Queue (`CRAWL_QUEUE`) and the
 * `queue` handler fans out messages. Locally / in tests we use
 * {@link MemoryCrawlQueue}, which applies the same retry policy in-process.
 */

export interface CrawlJob {
  watchId: string;
  workspaceId: string;
  url: string;
  attempt: number;
  fixture?: string;
  enqueuedAt: string;
}

export interface QueueSendResult {
  queued: number;
}

export interface CrawlQueue {
  send(job: Omit<CrawlJob, "attempt" | "enqueuedAt"> & { attempt?: number }): Promise<void>;
  sendBatch(
    jobs: Array<Omit<CrawlJob, "attempt" | "enqueuedAt"> & { attempt?: number }>,
  ): Promise<QueueSendResult>;
}

export const MAX_QUEUE_ATTEMPTS = 5;
export const BASE_BACKOFF_MS = 50;

export function backoffMs(attempt: number): number {
  // attempt is 1-based; cap so tests stay snappy
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), 2_000);
}

export function shouldRetry(attempt: number, err: unknown): boolean {
  if (attempt >= MAX_QUEUE_ATTEMPTS) return false;
  if (err instanceof Error && err.message.includes("fatal:")) return false;
  return true;
}

export type CrawlJobHandler = (job: CrawlJob) => Promise<void>;

/** In-memory queue that processes jobs with the production retry policy. */
export class MemoryCrawlQueue implements CrawlQueue {
  private handler: CrawlJobHandler | null = null;
  readonly processed: CrawlJob[] = [];
  readonly failed: Array<{ job: CrawlJob; error: string }> = [];
  private delay: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  setHandler(handler: CrawlJobHandler): void {
    this.handler = handler;
  }

  setDelay(fn: (ms: number) => Promise<void>): void {
    this.delay = fn;
  }

  reset(): void {
    this.processed.length = 0;
    this.failed.length = 0;
  }

  async send(job: Omit<CrawlJob, "attempt" | "enqueuedAt"> & { attempt?: number }): Promise<void> {
    await this.sendBatch([job]);
  }

  async sendBatch(
    jobs: Array<Omit<CrawlJob, "attempt" | "enqueuedAt"> & { attempt?: number }>,
  ): Promise<QueueSendResult> {
    for (const partial of jobs) {
      const job: CrawlJob = {
        ...partial,
        attempt: partial.attempt ?? 1,
        enqueuedAt: new Date().toISOString(),
      };
      await this.consume(job);
    }
    return { queued: jobs.length };
  }

  private async consume(job: CrawlJob): Promise<void> {
    if (!this.handler) {
      throw new Error("MemoryCrawlQueue has no handler; call setHandler() first");
    }
    try {
      await this.handler(job);
      this.processed.push(job);
    } catch (err) {
      if (shouldRetry(job.attempt, err)) {
        await this.delay(backoffMs(job.attempt));
        await this.consume({ ...job, attempt: job.attempt + 1 });
      } else {
        this.failed.push({
          job,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

export const crawlQueue = new MemoryCrawlQueue();
