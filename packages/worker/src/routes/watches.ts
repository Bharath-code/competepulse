import type { Hono } from "hono";
import { answerFromSnapshots } from "@competepulse/agent";
import { diffPricing, type WatchLabel } from "@competepulse/core";
import { isLocal } from "../access.js";
import { processCrawlJob } from "../crawl.js";
import { getStore } from "../get-store.js";
import { ensureMonitor, monitorsRequired, releaseMonitor, resolveMonitors } from "../monitor.js";
import { crawlQueue } from "../queue.js";
import { snapshotPublicPath } from "../r2.js";
import { CapError } from "../store.js";
import {
  type Env,
  WATCH_LABELS,
  bucket,
  requireAccess,
  scopedWorkspaceId,
  outOfScope,
  assertPlanAllows,
} from "../shared.js";

export function registerWatches(app: Hono<{ Bindings: Env }>) {
  app.post("/watches", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.competitor !== "string" || typeof body.url !== "string") {
      return c.json({ error: "competitor and url are required" }, 400);
    }
    const label: WatchLabel = WATCH_LABELS.includes(body.label) ? body.label : "other";
    const workspaceId =
      scopedWorkspaceId(c, typeof body.workspaceId === "string" ? body.workspaceId : undefined) ??
      (await data.ensureWorkspace("local")).id;
    const scoped = outOfScope(c, workspaceId);
    if (scoped) return scoped;
    const gate = await assertPlanAllows(data, workspaceId);
    if (!gate.ok) return c.json({ error: gate.error }, gate.status);
    const monitors = resolveMonitors(c.env);
    if (!monitors && monitorsRequired(c.env)) return c.json({ error: "secret_missing" }, 503);
    try {
      const watch = await data.addWatch({
        competitor: body.competitor,
        url: body.url,
        label,
        workspaceId,
      });
      if (monitors) {
        try {
          await ensureMonitor(data, monitors.provider, monitors.cfg, watch.url, watch.label);
        } catch {
          await data.removeWatch(watch.id, workspaceId);
          console.error(JSON.stringify({ event: "monitor_create_failed", watchId: watch.id }));
          return c.json({ error: "monitor_create_failed" }, 502);
        }
      }
      return c.json({ watch }, 201);
    } catch (err) {
      if (err instanceof CapError) {
        return c.json({ error: err.message, code: err.code, limits: err.limits }, 402);
      }
      throw err;
    }
  });

  app.get("/watches", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const workspaceId = scopedWorkspaceId(c, c.req.query("workspaceId") ?? undefined);
    const scoped = workspaceId ? outOfScope(c, workspaceId) : null;
    if (scoped) return scoped;
    return c.json({ watches: await getStore(c.env).listWatches(workspaceId) });
  });

  app.delete("/watches/:id", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const workspaceId = scopedWorkspaceId(c, c.req.query("workspaceId") ?? undefined);
    const target = await data.getWatch(c.req.param("id"));
    const scoped = outOfScope(c, target?.workspaceId);
    if (scoped) return scoped;
    if (workspaceId) {
      const gate = await assertPlanAllows(data, workspaceId);
      if (!gate.ok) return c.json({ error: gate.error }, gate.status);
    }
    const removed = await data.removeWatch(c.req.param("id"), workspaceId);
    if (!removed) return c.json({ error: "watch not found" }, 404);
    const monitors = resolveMonitors(c.env);
    if (monitors && target) {
      // best-effort: the nightly sweep deletes any monitor left behind
      await releaseMonitor(data, monitors.provider, target.url).catch(() => false);
    }
    return c.json({ removed: true });
  });

  app.post("/watches/:id/crawl", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const watch = await data.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    const scoped = outOfScope(c, watch.workspaceId);
    if (scoped) return scoped;
    const gate = await assertPlanAllows(data, watch.workspaceId);
    if (!gate.ok) return c.json({ error: gate.error }, gate.status);

    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const fixture = typeof body.fixture === "string" ? body.fixture : undefined;
    const sync = c.req.query("sync") === "1" || fixture !== undefined || !c.env.CRAWL_QUEUE;

    const job = {
      watchId: watch.id,
      workspaceId: watch.workspaceId,
      url: watch.url,
      fixture,
    };

    if (!sync && c.env.CRAWL_QUEUE) {
      await c.env.CRAWL_QUEUE.send({ ...job, attempt: 1, enqueuedAt: new Date().toISOString() });
      return c.json({ queued: true, watchId: watch.id }, 202);
    }

    try {
      const outcome = await processCrawlJob(
        { ...job, attempt: 1, enqueuedAt: new Date().toISOString() },
        {
          data,
          bucket: bucket(c.env),
          apiKey: c.env.FIRECRAWL_API_KEY,
          allowFixtures: isLocal(c.env),
        },
      );
      return c.json({
        provider: outcome.provider,
        snapshot: outcome.snapshot,
        change: outcome.change,
        snapshotUrl: outcome.snapshotUrl,
        run: outcome.run,
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  app.post("/queues/crawl/fanout", async (c) => {
    const denied = await requireAccess(c, "admin");
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined;
    const watches = await data.listWatches(workspaceId);
    const jobs = watches.map((w) => ({
      watchId: w.id,
      workspaceId: w.workspaceId,
      url: w.url,
      fixture: typeof body.fixture === "string" ? body.fixture : undefined,
      attempt: 1,
      enqueuedAt: new Date().toISOString(),
    }));

    if (c.env.CRAWL_QUEUE) {
      for (const job of jobs) {
        await c.env.CRAWL_QUEUE.send(job);
      }
      return c.json({ queued: jobs.length, watches: watches.length, transport: "cf_queue" });
    }

    if (!isLocal(c.env)) return c.json({ error: "crawl queue not configured" }, 503);

    const result = await crawlQueue.sendBatch(
      jobs.map(({ attempt: _a, enqueuedAt: _e, ...rest }) => rest),
    );
    return c.json({ ...result, watches: watches.length, transport: "memory" });
  });

  app.get("/watches/:id/changes", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const watch = await data.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    const scoped = outOfScope(c, watch.workspaceId);
    if (scoped) return scoped;
    const changes = await data.listChanges(watch.id);
    const mapped = [];
    for (const change of changes) {
      const snap = change.toSnapshotId ? await data.getSnapshot(change.toSnapshotId) : undefined;
      mapped.push({
        ...change,
        snapshotUrl: snap ? snapshotPublicPath(snap.r2Key) : null,
      });
    }
    return c.json({ changes: mapped });
  });

  app.get("/watches/:id/snapshots", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const watch = await data.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    const scoped = outOfScope(c, watch.workspaceId);
    if (scoped) return scoped;
    const snapshots = (await data.listSnapshots(watch.id)).map((s) => ({
      ...s,
      snapshotUrl: snapshotPublicPath(s.r2Key),
    }));
    return c.json({ snapshots });
  });

  app.get("/snapshots/:key", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const key = decodeURIComponent(c.req.param("key"));
    const owner = await getStore(c.env).getWatch(/^watches\/([^/]+)\//.exec(key)?.[1] ?? "");
    const scoped = outOfScope(c, owner?.workspaceId);
    if (scoped) return scoped;
    const obj = await bucket(c.env).get(key);
    if (!obj) return c.json({ error: "snapshot not found" }, 404);
    return c.json(JSON.parse(obj.body));
  });

  app.post("/diff", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.to !== "object" || body.to === null) {
      return c.json({ error: "'to' pricing snapshot is required" }, 400);
    }
    const url = typeof body.url === "string" ? body.url : "about:blank";
    const event = diffPricing(body.from ?? null, body.to, url);
    return c.json({ change: event });
  });

  app.post("/qa", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.question !== "string") {
      return c.json({ error: "question is required" }, 400);
    }
    const workspaceId =
      scopedWorkspaceId(c, typeof body.workspaceId === "string" ? body.workspaceId : undefined) ??
      (await data.ensureWorkspace("local")).id;
    const scoped = outOfScope(c, workspaceId);
    if (scoped) return scoped;
    const watches = await data.listWatches(workspaceId);
    const changes = (await data.listWorkspaceChanges(workspaceId)).filter(
      (ch) => ch.materiality !== "none",
    );
    const snapshots = [];
    for (const w of watches) {
      for (const s of await data.listSnapshots(w.id)) {
        snapshots.push({
          id: s.id,
          watchId: w.id,
          competitor: w.competitor,
          url: w.url,
          summaryHints: [JSON.stringify(s.extracted)],
          r2Key: s.r2Key,
          snapshotUrl: snapshotPublicPath(s.r2Key),
        });
      }
    }
    const result = answerFromSnapshots(body.question, { changes, snapshots });
    return c.json(result);
  });
}
