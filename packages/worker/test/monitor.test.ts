import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app.js";
import { runWorkspaceDigest } from "../src/digest.js";
import { getStore } from "../src/get-store.js";
import {
  firecrawlMonitors,
  monitorBody,
  reconcileMonitors,
  type MonitorProvider,
  type ObservedPage,
} from "../src/monitor.js";
import { memorySnapshots } from "../src/r2.js";
import { store, type StoredChange } from "../src/store.js";
import { FIXTURES } from "../src/scrape.js";

const SECRET = "whsec_test";
const app = createApp();

function fakeProvider() {
  const live = new Map<string, string>();
  const pages = new Map<string, ObservedPage>();
  let n = 0;
  const provider: MonitorProvider = {
    async create({ url }) {
      const providerId = `mon_${(n += 1)}`;
      live.set(providerId, url);
      return { providerId };
    },
    async delete(id) {
      live.delete(id);
    },
    async list() {
      return [...live].map(([providerId, url]) => ({ providerId, urls: [url] }));
    },
    async getPage(_id, checkId) {
      return pages.get(checkId) ?? null;
    },
  };
  return { provider, live, pages };
}

let fake = fakeProvider();
const env = (): Env => ({
  ENVIRONMENT: "local",
  FIRECRAWL_WEBHOOK_SECRET: SECRET,
  monitorProvider: fake.provider,
});

type WatchBody = { watch: { id: string } };
const json = { "Content-Type": "application/json" };
const wid = (team: string) => store.ensureWorkspace(team).id;
const addWatch = (team: string, url = "https://rival.example/pricing", label = "pricing") =>
  app.request(
    "/watches",
    {
      method: "POST",
      headers: json,
      body: JSON.stringify({ competitor: "Rival", url, label, workspaceId: wid(team) }),
    },
    env(),
  );

function hook(
  monitorId: string,
  checkId: string,
  opts: { auth?: string | null; status?: string } = {},
) {
  const headers: Record<string, string> = { ...json };
  if (opts.auth !== null) headers.Authorization = opts.auth ?? `Bearer ${SECRET}`;
  return app.request(
    "/monitor/webhook",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        success: true,
        type: "monitor.page",
        id: checkId,
        data: [
          {
            monitorId,
            checkId,
            url: "x",
            status: opts.status ?? "changed",
            currentScrapeId: "scrape1",
          },
        ],
      }),
    },
    env(),
  );
}

describe("E1 monitors", () => {
  beforeEach(() => {
    store.reset();
    memorySnapshots.clear();
    fake = fakeProvider();
  });

  it("creates exactly one provider monitor per URL across tenants", async () => {
    await addWatch("ws-a");
    await addWatch("ws-b");
    expect(fake.live.size).toBe(1);
    await addWatch("ws-a", "https://rival.example/changelog", "changelog");
    expect(fake.live.size).toBe(2);
  });

  it("deletes the monitor only after the last tenant stops watching", async () => {
    const a = ((await (await addWatch("ws-a")).json()) as WatchBody).watch.id;
    const b = ((await (await addWatch("ws-b")).json()) as WatchBody).watch.id;
    await app.request(`/watches/${a}?workspaceId=${wid("ws-a")}`, { method: "DELETE" }, env());
    expect(fake.live.size).toBe(1);
    await app.request(`/watches/${b}?workspaceId=${wid("ws-b")}`, { method: "DELETE" }, env());
    expect(fake.live.size).toBe(0);
  });

  it("rejects unsigned and badly signed webhooks, storing nothing", async () => {
    await addWatch("ws-a");
    const [providerId] = [...fake.live.keys()];
    fake.pages.set("c1", { extracted: FIXTURES.acme_v1, credits: 2 });
    expect((await hook(providerId, "c1", { auth: null })).status).toBe(401);
    expect((await hook(providerId, "c1", { auth: "Bearer nope" })).status).toBe(401);
    expect(memorySnapshots.size()).toBe(0);
    expect((await store.listMonitors()).length).toBe(1);
  });

  it("fails closed in prod without the webhook secret", async () => {
    const res = await app.request(
      "/monitor/webhook",
      { method: "POST", body: "{}" },
      { ENVIRONMENT: "production" },
    );
    expect(res.status).toBe(503);
  });

  it("fans one event out to every tenant, stores one change per watch, and meters credits", async () => {
    const aId = ((await (await addWatch("ws-a")).json()) as WatchBody).watch.id;
    const bId = ((await (await addWatch("ws-b")).json()) as WatchBody).watch.id;
    const [providerId] = [...fake.live.keys()];
    fake.pages.set("c1", { extracted: FIXTURES.acme_v1, credits: 2 });
    fake.pages.set("c2", { extracted: FIXTURES.acme_v2, credits: 2 });

    expect(await (await hook(providerId, "c1", { status: "new" })).json()).toEqual({ accepted: 1 });
    expect(await (await hook(providerId, "c2")).json()).toEqual({ accepted: 1 });

    for (const id of [aId, bId]) {
      const changes = await store.listChanges(id);
      expect(changes).toHaveLength(2);
      expect(changes[1].materiality).not.toBe("none");
    }
    const usage = await store.usageSummary((await store.getWatch(aId))!.workspaceId);
    expect(usage.byMetric.crawl.quantity).toBe(2);
  });

  it("replayed webhook stores exactly one change event", async () => {
    const wId = ((await (await addWatch("ws-a")).json()) as WatchBody).watch.id;
    const [providerId] = [...fake.live.keys()];
    fake.pages.set("c1", { extracted: FIXTURES.acme_v1, credits: 1 });
    await hook(providerId, "c1", { status: "new" });
    const replay = await hook(providerId, "c1", { status: "new" });
    expect(await replay.json()).toEqual({ accepted: 0 });
    expect(await store.listChanges(wId)).toHaveLength(1);
    expect(memorySnapshots.size()).toBeGreaterThanOrEqual(1);
  });

  it("releases the claim when processing fails so Firecrawl's retry succeeds", async () => {
    await addWatch("ws-a");
    const [providerId] = [...fake.live.keys()];
    const failing = await hook(providerId, "c-missing", { status: "new" });
    expect(failing.status).toBe(500);
    fake.pages.set("c-missing", { extracted: FIXTURES.acme_v1, credits: 1 });
    expect(await (await hook(providerId, "c-missing", { status: "new" })).json()).toEqual({
      accepted: 1,
    });
  });

  it("digest excludes a change whose snapshot is not written", async () => {
    const wId = ((await (await addWatch("ws-a")).json()) as WatchBody).watch.id;
    const watch = (await store.getWatch(wId))!;
    const orphan: StoredChange = {
      id: "orphan",
      watchId: wId,
      materiality: "high",
      summary: "ORPHAN-CHANGE",
      findings: [],
      citations: [],
      toSnapshotId: "missing-snapshot",
      createdAt: new Date().toISOString(),
    };
    await store.addChange(orphan);
    const now = new Date("2026-10-07T13:00:00Z");
    orphan.createdAt = now.toISOString();
    const res = await runWorkspaceDigest(getStore(), watch.workspaceId, now);
    expect(res.body).not.toContain("ORPHAN-CHANGE");
  });

  it("reconcile backfills missing monitors and removes unwatched ones", async () => {
    await store.addWatch({
      competitor: "R",
      url: "https://r.example/p",
      label: "pricing",
      workspaceId: "ws-a",
    });
    const cfg = { webhookUrl: "http://x/monitor/webhook", webhookSecret: SECRET };
    expect(await reconcileMonitors(getStore(), fake.provider, cfg)).toEqual({
      created: 1,
      released: 0,
    });
    for (const w of await store.listWatches()) store.removeWatch(w.id);
    expect(await reconcileMonitors(getStore(), fake.provider, cfg)).toEqual({
      created: 0,
      released: 1,
    });
    expect(fake.live.size).toBe(0);
  });
});

describe("firecrawl provider (v2)", () => {
  it("creates a JSON change-tracking monitor with a webhook secret header", async () => {
    type Body = {
      goal: string;
      targets: Array<{ scrapeOptions: { formats: unknown[] } }>;
      webhook: { headers: { Authorization: string } };
    };
    let seen: { url: string; body: Body; auth: string } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = {
        url,
        body: JSON.parse(init.body as string),
        auth: (init.headers as Record<string, string>).Authorization,
      };
      return new Response(JSON.stringify({ success: true, data: { id: "m1" } }));
    }) as unknown as typeof fetch;
    const out = await firecrawlMonitors("fc-key", f).create({
      url: "https://r.example/pricing",
      label: "pricing",
      webhookUrl: "https://w.example/monitor/webhook",
      webhookSecret: "s3",
    });
    expect(out.providerId).toBe("m1");
    expect(seen!.url).toBe("https://api.firecrawl.dev/v2/monitor");
    expect(seen!.auth).toBe("Bearer fc-key");
    const t = seen!.body.targets[0];
    expect(t.scrapeOptions.formats[0]).toMatchObject({ type: "changeTracking", modes: ["json"] });
    expect(seen!.body.webhook.headers.Authorization).toBe("Bearer s3");
    expect(seen!.body.goal).toContain("pricing");
  });

  it("getPage reads snapshot.json for the URL from changed then new pages", async () => {
    const f = (async (url: string) =>
      new Response(
        JSON.stringify({
          data: {
            actualCredits: 3,
            pages: url.includes("status=new")
              ? [{ url: "https://r.example/p", snapshot: { json: { currency: "USD", plans: [] } } }]
              : [],
          },
        }),
      )) as unknown as typeof fetch;
    const page = await firecrawlMonitors("k", f).getPage("m1", "c1", "https://r.example/p");
    expect(page).toEqual({ extracted: { currency: "USD", plans: [] }, credits: 3 });
  });

  it("monitorBody picks the changelog schema for changelog pages", () => {
    const b = monitorBody({ url: "u", label: "changelog", webhookUrl: "w", webhookSecret: "s" });
    expect(JSON.stringify(b.targets[0])).toContain("entries");
  });
});
