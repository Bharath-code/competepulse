import { isLocal } from "./access.js";
import { createApp, type Env } from "./app.js";
import { processCrawlJob } from "./crawl.js";
import { deliverAllWorkspaceDigests, alertFounder } from "./digest-deliver.js";
import { getStore } from "./get-store.js";
import type { CrawlJob } from "./queue.js";
import { isMonitorPageJob, processMonitorJob } from "./routes/monitor.js";
import { reconcileMonitors, resolveMonitors } from "./monitor.js";
import { adaptR2Binding, memorySnapshots } from "./r2.js";

const app = createApp();

export default {
  fetch: app.fetch.bind(app),

  /** Weekday digest cron. Crawls are Monitor-driven (E1); cron only reconciles monitors and posts digests. */
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const data = getStore(env);
    const monitors = resolveMonitors(env);
    if (monitors) {
      try {
        await reconcileMonitors(data, monitors.provider, monitors.cfg);
      } catch (err) {
        ctx.waitUntil(alertFounder(env, `Monitor reconcile failed: ${String(err)}`));
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
  async queue(batch: MessageBatch<CrawlJob | unknown>, env: Env): Promise<void> {
    const data = getStore(env);
    const bucket = env.SNAPSHOTS ? adaptR2Binding(env.SNAPSHOTS) : memorySnapshots;
    for (const msg of batch.messages) {
      try {
        const body: unknown = msg.body;
        if (isMonitorPageJob(body)) {
          const monitors = resolveMonitors(env);
          if (!monitors) throw new Error("monitor provider not configured");
          await processMonitorJob(body, { data, bucket, provider: monitors.provider });
        } else {
          await processCrawlJob(body as CrawlJob, {
            data,
            bucket,
            apiKey: env.FIRECRAWL_API_KEY,
            allowFixtures: isLocal(env),
          });
        }
        msg.ack();
      } catch {
        msg.retry();
      }
    }
  },
};
