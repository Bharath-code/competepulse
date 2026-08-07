import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app.js";
import { crawlQueue, shouldRetry, backoffMs } from "../src/queue.js";
import { memorySnapshots } from "../src/r2.js";
import { CapError, store } from "../src/store.js";

const env: Env = {};
const app = createApp();

function post(path: string, body: unknown) {
  return app.request(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    env,
  );
}

describe("E2 crawl pipeline", () => {
  beforeEach(() => {
    store.reset();
    memorySnapshots.clear();
    crawlQueue.reset();
  });

  it("E2-3 writes immutable R2 snapshots with stable content hashes", async () => {
    const created = await post("/watches", {
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    const { watch } = (await created.json()) as { watch: { id: string } };

    const first = await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v1" });
    const firstBody = (await first.json()) as {
      snapshot: { contentHash: string; r2Key: string };
      snapshotUrl: string;
    };
    expect(firstBody.snapshot.r2Key).toContain(firstBody.snapshot.contentHash);
    expect(memorySnapshots.size()).toBe(1);

    const again = await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v1" });
    const againBody = (await again.json()) as { snapshot: { contentHash: string } };
    expect(againBody.snapshot.contentHash).toBe(firstBody.snapshot.contentHash);

    const snapRes = await app.request(firstBody.snapshotUrl, {}, env);
    expect(snapRes.status).toBe(200);
    expect(((await snapRes.json()) as { contentHash: string }).contentHash).toBe(
      firstBody.snapshot.contentHash,
    );
  });

  it("E2-5 falls back to browser when scrape is thin", async () => {
    const created = await post("/watches", {
      competitor: "Acme",
      url: "https://acme.example/app",
      label: "pricing",
    });
    const { watch } = (await created.json()) as { watch: { id: string } };
    const res = await post(`/watches/${watch.id}/crawl`, { fixture: "thin_page" });
    const body = (await res.json()) as { provider: string; snapshot: { markdown: string } };
    expect(body.provider).toBe("browser");
    expect(body.snapshot.markdown.length).toBeGreaterThan(200);
  });

  it("E2-2 scrapes changelog fixtures with markdown + JSON", async () => {
    const created = await post("/watches", {
      competitor: "Acme",
      url: "https://acme.example/changelog",
      label: "changelog",
    });
    const { watch } = (await created.json()) as { watch: { id: string } };
    await post(`/watches/${watch.id}/crawl`, { fixture: "changelog_v1" });
    const second = await post(`/watches/${watch.id}/crawl`, { fixture: "changelog_v2" });
    const body = (await second.json()) as {
      change: { materiality: string; summary: string };
      snapshot: { markdown: string; extracted: { entries: unknown[] } };
    };
    expect(body.change.materiality).toBe("high");
    expect(body.change.summary).toContain("SSO");
    expect(body.snapshot.markdown).toContain("```json");
    expect(body.snapshot.extracted.entries).toHaveLength(2);
  });

  it("E2-6 rejects the 26th URL on Starter with upgrade message", async () => {
    const ws = store.ensureWorkspace("T_CAPS", "starter");
    for (let i = 0; i < 25; i += 1) {
      store.addWatch({
        workspaceId: ws.id,
        competitor: `Comp${Math.floor(i / 5)}`,
        url: `https://example.com/p/${i}`,
        label: "pricing",
      });
    }
    const res = await post("/watches", {
      workspaceId: ws.id,
      competitor: "Comp0",
      url: "https://example.com/p/26",
      label: "pricing",
    });
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("PLAN_CAP_EXCEEDED");
    expect(body.error).toContain("Upgrade to Pro");
  });

  it("E2-1 queue fan-out retries with backoff policy", async () => {
    expect(shouldRetry(1, new Error("temp"))).toBe(true);
    expect(shouldRetry(5, new Error("temp"))).toBe(false);
    expect(shouldRetry(1, new Error("fatal: nope"))).toBe(false);
    expect(backoffMs(1)).toBe(50);
    expect(backoffMs(3)).toBe(200);

    const ws = store.ensureWorkspace("T_Q");
    const watch = store.addWatch({
      workspaceId: ws.id,
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    const fanout = await post("/queues/crawl/fanout", {
      workspaceId: ws.id,
      fixture: "acme_v1",
    });
    expect(((await fanout.json()) as { queued: number }).queued).toBe(1);
    expect(store.listSnapshots(watch.id).length).toBe(1);
  });
});

describe("E3 digest + Q&A", () => {
  beforeEach(() => {
    store.reset();
    memorySnapshots.clear();
  });

  it("E3-1 formats Slack blocks with cite + why it matters", async () => {
    const ws = store.ensureWorkspace("T_D");
    const watch = store.addWatch({
      workspaceId: ws.id,
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v1" });
    await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v2" });

    // Align change timestamps to the digest day
    for (const change of store.listChanges(watch.id)) {
      change.createdAt = "2026-08-06T12:00:00Z";
    }

    const res = await post("/digests/run", {
      workspaceId: ws.id,
      now: "2026-08-06T13:00:00Z",
    });
    const body = (await res.json()) as {
      result: { delivered: boolean; body: string; blocks: Array<Record<string, unknown>> };
    };
    expect(body.result.delivered).toBe(true);
    expect(body.result.body).toContain("Why it matters");
    expect(body.result.blocks?.some((b) => b.type === "header" || b.type === "section")).toBe(true);
  });

  it("E3-2 skip quiet mode omits delivery when all quiet", async () => {
    const ws = store.ensureWorkspace("T_QMODE");
    store.updateWorkspace(ws.id, { quietMode: "skip" });
    store.addWatch({
      workspaceId: ws.id,
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    const res = await post("/digests/run", {
      workspaceId: ws.id,
      now: "2026-08-06T13:00:00Z",
    });
    const body = (await res.json()) as { result: { delivered: boolean; skipped: boolean } };
    expect(body.result.skipped).toBe(true);
    expect(body.result.delivered).toBe(false);
  });

  it("E3-3 answers only from snapshots/changes with citations", async () => {
    const ws = store.ensureWorkspace("T_QA");
    const watch = store.addWatch({
      workspaceId: ws.id,
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v1" });
    await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v2" });

    const ok = await post("/qa", {
      workspaceId: ws.id,
      question: "Did Acme change price or SSO?",
    });
    const okBody = (await ok.json()) as { grounded: boolean; citations: string[]; answer: string };
    expect(okBody.grounded).toBe(true);
    expect(okBody.citations[0]).toContain("acme.example");
    expect(okBody.answer.toLowerCase()).toMatch(/price|sso/);

    const refused = await post("/qa", {
      workspaceId: ws.id,
      question: "What is their private ARR?",
    });
    expect(((await refused.json()) as { refused: boolean }).refused).toBe(true);
  });

  it("E3-4 cannot publish battlecard without HITL approval", async () => {
    const ws = store.ensureWorkspace("T_BC");
    const created = await post("/battlecards", {
      workspaceId: ws.id,
      changeId: "chg1",
      summary: "Price hike",
      citations: ["https://acme.example/pricing"],
    });
    const { battlecard } = (await created.json()) as { battlecard: { id: string } };
    const blocked = await post(`/battlecards/${battlecard.id}/publish`, {});
    expect(blocked.status).toBe(409);

    await post(`/battlecards/${battlecard.id}/decision`, {
      decision: "approved",
      actor: "U1",
    });
    const published = await post(`/battlecards/${battlecard.id}/publish`, {});
    expect(published.status).toBe(200);
    expect(
      ((await published.json()) as { battlecard: { publishedAt?: string } }).battlecard.publishedAt,
    ).toBeTruthy();
  });
});

describe("E4 dashboard + E5 cost meter", () => {
  beforeEach(() => {
    store.reset();
    memorySnapshots.clear();
  });

  it("serves dashboard HTML with watchlist + history hooks", async () => {
    const res = await app.request("/dashboard", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Watchlist");
    expect(html).toContain("Change history");
    expect(html).toContain("Cost meter");
  });

  it("E4-3 returns change history with snapshot links", async () => {
    const ws = store.ensureWorkspace("T_HIST");
    const watch = store.addWatch({
      workspaceId: ws.id,
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v1" });
    await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v2" });

    const list = await app.request(`/workspaces/${ws.id}/changes`, {}, env);
    const body = (await list.json()) as {
      changes: Array<{ id: string; snapshotUrl: string | null }>;
    };
    expect(body.changes.length).toBeGreaterThan(0);
    expect(body.changes.some((c) => c.snapshotUrl)).toBe(true);

    const detail = await app.request(`/changes/${body.changes[1]!.id}`, {}, env);
    expect(detail.status).toBe(200);
    expect(((await detail.json()) as { snapshotUrl: string }).snapshotUrl).toContain("/snapshots/");
  });

  it("E5-3 tracks per-workspace crawl cost", async () => {
    const ws = store.ensureWorkspace("T_COST");
    const watch = store.addWatch({
      workspaceId: ws.id,
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v1" });
    await post(`/watches/${watch.id}/crawl`, { fixture: "thin_page" });

    const usage = await app.request(`/workspaces/${ws.id}/usage`, {}, env);
    const body = (await usage.json()) as {
      totalCostCents: number;
      byMetric: Record<string, { quantity: number }>;
    };
    expect(body.totalCostCents).toBeGreaterThan(0);
    expect(body.byMetric.crawl?.quantity).toBe(1);
    expect(body.byMetric.browser?.quantity).toBe(1);
  });

  it("throws CapError with upgrade copy at competitor limit", () => {
    const ws = store.ensureWorkspace("T_COMP", "starter");
    for (let i = 0; i < 5; i += 1) {
      store.addWatch({
        workspaceId: ws.id,
        competitor: `C${i}`,
        url: `https://c${i}.example/pricing`,
        label: "pricing",
      });
    }
    expect(() =>
      store.addWatch({
        workspaceId: ws.id,
        competitor: "C5",
        url: "https://c5.example/pricing",
        label: "pricing",
      }),
    ).toThrow(CapError);
  });
});
