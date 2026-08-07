import { createApp, type Env } from "./app.js";
import { processCrawlJob } from "./crawl.js";
import { runAllWorkspaceDigests } from "./digest.js";
import type { CrawlJob } from "./queue.js";
import { adaptR2Binding, memorySnapshots } from "./r2.js";
import { store } from "./store.js";

const app = createApp();

export default {
  fetch: app.fetch.bind(app),

  /** Weekday digest cron (E1-4). Idempotent per workspace/day. */
  async scheduled(
    _controller: ScheduledController,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    runAllWorkspaceDigests(store, new Date());
  },

  /** Cloudflare Queue consumer (E2-1) with per-message retries. */
  async queue(batch: MessageBatch<CrawlJob>, env: Env): Promise<void> {
    const bucket = env.SNAPSHOTS ? adaptR2Binding(env.SNAPSHOTS) : memorySnapshots;
    for (const msg of batch.messages) {
      try {
        await processCrawlJob(msg.body, {
          data: store,
          bucket,
          apiKey: env.FIRECRAWL_API_KEY,
        });
        msg.ack();
      } catch {
        msg.retry();
      }
    }
  },
};
