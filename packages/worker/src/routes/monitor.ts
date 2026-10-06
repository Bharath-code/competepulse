import type { Hono } from "hono";
import { planLimits } from "@competepulse/core";
import { constantTimeEqual, secretMissing } from "../access.js";
import { ingestObservation } from "../crawl.js";
import { getStore } from "../get-store.js";
import type { MonitorProvider } from "../monitor.js";
import { resolveMonitors } from "../monitor.js";
import type { SnapshotBucket } from "../r2.js";
import type { Store } from "../store.js";
import { type Env, bucket } from "../shared.js";

export interface MonitorPageJob {
  kind: "monitor_page";
  eventId: string;
  providerId: string;
  checkId: string;
  url: string;
}

export function isMonitorPageJob(body: unknown): body is MonitorPageJob {
  return (body as MonitorPageJob | null)?.kind === "monitor_page";
}

/**
 * Queue consumer body: check page → every tenant watching the URL gets its own
 * snapshot + change event. Credits are split evenly across subscribers.
 */
export async function processMonitorJob(
  job: MonitorPageJob,
  deps: { data: Store; bucket: SnapshotBucket; provider: MonitorProvider },
): Promise<number> {
  const { data, bucket, provider } = deps;
  const watches = await data.listWatchesByUrl(job.url);
  if (watches.length === 0) return 0;

  const page = await provider.getPage(job.providerId, job.checkId, job.url);
  if (!page) throw new Error(`monitor page not ready: ${job.checkId} ${job.url}`);

  const share = page.credits / watches.length;
  for (const watch of watches) {
    const ws = await data.getWorkspace(watch.workspaceId);
    const limits = planLimits(ws?.plan ?? "starter");
    await ingestObservation(
      watch,
      {
        extracted: page.extracted,
        markdown: "",
        provider: "firecrawl",
        crawlRunId: null,
        usageMetric: "crawl",
        usageQuantity: share,
        costCents: Math.round(share * limits.crawlCostCents),
      },
      { data, bucket },
    );
    await data.touchWatch(watch.id, true);
  }
  return watches.length;
}

type WebhookEntry = {
  monitorId?: string;
  checkId?: string;
  currentScrapeId?: string | null;
  status?: string;
};

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
}

export function registerMonitor(app: Hono<{ Bindings: Env }>) {
  app.post("/monitor/webhook", async (c) => {
    const secret = c.env.FIRECRAWL_WEBHOOK_SECRET?.trim();
    if (secretMissing(secret, c.env, "FIRECRAWL_WEBHOOK_SECRET")) {
      return c.json({ error: "secret_missing" }, 503);
    }
    if (secret) {
      const got = bearer(c.req.raw);
      if (!got || !constantTimeEqual(got, secret)) return c.json({ error: "unauthorized" }, 401);
    }

    const payload = await c.req.json().catch(() => null);
    if (!payload || typeof payload !== "object") return c.json({ error: "invalid body" }, 400);
    if (payload.type !== "monitor.page") return c.json({ ignored: payload.type ?? null });

    const data = getStore(c.env);
    const store = bucket(c.env);
    const monitors = resolveMonitors(c.env);
    let accepted = 0;

    for (const entry of (payload.data ?? []) as WebhookEntry[]) {
      if (entry.status !== "changed" && entry.status !== "new") continue;
      if (!entry.monitorId || !entry.checkId) continue;
      const monitor = await data.getMonitorByProviderId(entry.monitorId);
      if (!monitor) continue;

      const eventId = `${entry.checkId}:${entry.currentScrapeId ?? monitor.url}`;
      const payloadR2Key = `monitor-events/${monitor.id}/${encodeURIComponent(eventId)}.json`;
      await store.put(payloadR2Key, JSON.stringify({ ...payload, data: [entry] }));

      const claimed = await data.claimMonitorEvent({
        id: eventId,
        monitorId: monitor.id,
        payloadR2Key,
        receivedAt: new Date().toISOString(),
      });
      if (!claimed) continue;

      const job: MonitorPageJob = {
        kind: "monitor_page",
        eventId,
        providerId: monitor.providerId,
        checkId: entry.checkId,
        url: monitor.url,
      };
      try {
        if (c.env.CRAWL_QUEUE) await c.env.CRAWL_QUEUE.send(job);
        else if (monitors)
          await processMonitorJob(job, { data, bucket: store, provider: monitors.provider });
        else throw new Error("no queue and no monitor provider");
      } catch {
        await data.releaseMonitorEvent(eventId);
        console.error(JSON.stringify({ event: "monitor_enqueue_failed", eventId }));
        return c.json({ error: "enqueue_failed" }, 500);
      }
      accepted += 1;
    }
    return c.json({ accepted });
  });
}
