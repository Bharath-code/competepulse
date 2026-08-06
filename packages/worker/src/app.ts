import { diffPricing, type WatchLabel } from "@competepulse/core";
import { Hono } from "hono";
import { scrape } from "./scrape.js";
import { contentHash, store, type Snapshot, type StoredChange } from "./store.js";

export interface Env {
  FIRECRAWL_API_KEY?: string;
}

const WATCH_LABELS: WatchLabel[] = ["pricing", "changelog", "docs", "careers", "other"];

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) =>
    c.json({ status: "ok", service: "competepulse-worker", watches: store.listWatches().length }),
  );

  app.post("/watches", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.competitor !== "string" || typeof body.url !== "string") {
      return c.json({ error: "competitor and url are required" }, 400);
    }
    const label: WatchLabel = WATCH_LABELS.includes(body.label) ? body.label : "other";
    const watch = store.addWatch({ competitor: body.competitor, url: body.url, label });
    return c.json({ watch }, 201);
  });

  app.get("/watches", (c) => c.json({ watches: store.listWatches() }));

  app.delete("/watches/:id", (c) => {
    const removed = store.removeWatch(c.req.param("id"));
    if (!removed) return c.json({ error: "watch not found" }, 404);
    return c.json({ removed: true });
  });

  // Enqueue-and-run an immediate crawl for a watch (mirrors the CF Queue
  // consumer in production). Scrapes, snapshots, and diffs against the
  // previous snapshot to emit a materiality-classified change event.
  app.post("/watches/:id/crawl", async (c) => {
    const watch = store.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);

    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const fixture = typeof body.fixture === "string" ? body.fixture : undefined;

    const result = await scrape(watch.url, { apiKey: c.env.FIRECRAWL_API_KEY, fixture });
    const previous = store.latestSnapshot(watch.id);

    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      watchId: watch.id,
      contentHash: contentHash(result.extracted),
      extracted: result.extracted,
      createdAt: new Date().toISOString(),
    };
    store.addSnapshot(snapshot);

    const event = diffPricing(previous?.extracted ?? null, result.extracted, watch.url);
    const change: StoredChange = {
      ...event,
      id: crypto.randomUUID(),
      watchId: watch.id,
      createdAt: new Date().toISOString(),
    };
    store.addChange(change);

    return c.json({ provider: result.provider, snapshot, change });
  });

  app.get("/watches/:id/changes", (c) => {
    const watch = store.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    return c.json({ changes: store.listChanges(watch.id) });
  });

  // Stateless diff helper: classify the materiality between two supplied
  // pricing snapshots without persisting anything.
  app.post("/diff", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.to !== "object" || body.to === null) {
      return c.json({ error: "'to' pricing snapshot is required" }, 400);
    }
    const url = typeof body.url === "string" ? body.url : "about:blank";
    const event = diffPricing(body.from ?? null, body.to, url);
    return c.json({ change: event });
  });

  return app;
}
