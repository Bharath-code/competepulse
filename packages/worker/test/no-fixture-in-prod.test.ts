import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processCrawlJob } from "../src/crawl.js";
import { memorySnapshots } from "../src/r2.js";
import { store } from "../src/store.js";

const acme = { plans: [{ name: "Pro", priceMonthly: 99 }] };

function job(watchId: string, workspaceId: string, fixture?: string) {
  return {
    watchId,
    workspaceId,
    url: "https://real.example/pricing",
    fixture,
    attempt: 1,
    enqueuedAt: "",
  };
}

describe("fixtures never reach stored history outside local", () => {
  let watch: { id: string; workspaceId: string };
  beforeEach(() => {
    store.reset();
    const ws = store.ensureWorkspace("T_PROD");
    watch = store.addWatch({
      workspaceId: ws.id,
      competitor: "Real",
      url: "https://real.example/pricing",
      label: "pricing",
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const noRows = () => {
    expect(store.listSnapshots(watch.id)).toHaveLength(0);
    expect(store.listChanges(watch.id)).toHaveLength(0);
  };

  it("thin Firecrawl scrape errors and writes no snapshot or change", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ data: { markdown: "ok", json: acme } }));
    await expect(
      processCrawlJob(job(watch.id, watch.workspaceId), {
        data: undefined,
        bucket: memorySnapshots,
        apiKey: "fc-key",
      }),
    ).rejects.toThrow(/browser_fallback_unavailable/);
    noRows();
  });

  it("no API key errors instead of serving the Acme fixture", async () => {
    await expect(
      processCrawlJob(job(watch.id, watch.workspaceId, "acme_v1"), { bucket: memorySnapshots }),
    ).rejects.toThrow(/scrape_unavailable/);
    noRows();
  });
});
