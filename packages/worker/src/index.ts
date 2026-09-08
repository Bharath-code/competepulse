import { createApp, type Env } from "./app.js";
import { processCrawlJob } from "./crawl.js";
import { deliverAllWorkspaceDigests, alertFounder } from "./digest-deliver.js";
import { getStore } from "./get-store.js";
import type { CrawlJob } from "./queue.js";
import { adaptR2Binding, memorySnapshots } from "./r2.js";

const app = createApp();

export default {
  fetch: app.fetch.bind(app),

  /** Weekday digest cron (E1-4). Fan-out crawls then post digests. */
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const data = getStore(env);
    const watches = await data.listWatches();
    if (env.CRAWL_QUEUE) {
      for (const w of watches) {
        ctx.waitUntil(
          env.CRAWL_QUEUE.send({
            watchId: w.id,
            workspaceId: w.workspaceId,
            url: w.url,
            attempt: 1,
            enqueuedAt: new Date().toISOString(),
          }),
        );
      }
    }

    const results = await deliverAllWorkspaceDigests(data, env, new Date());
    for (const r of results) {
      if (r.delivered && r.slackError) {
        ctx.waitUntil(
          alertFounder(env, `Digest delivery issue: ${r.slackError} (${r.deliveryDate})`),
        );
      }
    }
  },

  /** Cloudflare Queue consumer (E2-1) with per-message retries. */
  async queue(batch: MessageBatch<CrawlJob>, env: Env): Promise<void> {
    const data = getStore(env);
    const bucket = env.SNAPSHOTS ? adaptR2Binding(env.SNAPSHOTS) : memorySnapshots;
    for (const msg of batch.messages) {
      try {
        await processCrawlJob(msg.body, {
          data,
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
