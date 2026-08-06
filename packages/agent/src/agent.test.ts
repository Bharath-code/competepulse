import { describe, expect, it } from "vitest";
import type { CompetePulseClient } from "./client.js";
import { formatDigest } from "./digest.js";
import { draftBattlecard, watchAdd, watchList, watchRemove } from "./tools.js";
import type { StoredChange, Watch, WatchInput } from "./types.js";

class FakeClient implements CompetePulseClient {
  watches = new Map<string, Watch>();
  changes: StoredChange[] = [];
  private seq = 0;

  async addWatch(input: WatchInput): Promise<Watch> {
    const watch: Watch = { ...input, id: `w${(this.seq += 1)}`, createdAt: "2026-08-06T00:00:00Z" };
    this.watches.set(watch.id, watch);
    return watch;
  }
  async listWatches(): Promise<Watch[]> {
    return [...this.watches.values()];
  }
  async removeWatch(id: string): Promise<boolean> {
    return this.watches.delete(id);
  }
  async crawl(watchId: string): Promise<StoredChange> {
    const change = makeChange(watchId, "high");
    this.changes.push(change);
    return change;
  }
  async getChanges(watchId: string): Promise<StoredChange[]> {
    return this.changes.filter((c) => c.watchId === watchId);
  }
}

function makeChange(watchId: string, materiality: "none" | "low" | "high"): StoredChange {
  return {
    id: `c-${watchId}-${materiality}`,
    watchId,
    materiality,
    summary: "Pro monthly price changed USD 99 -> USD 129.",
    findings: [],
    citations: ["https://acme.example/pricing"],
    createdAt: "2026-08-06T00:00:00Z",
  };
}

describe("agent tools", () => {
  it("adds, lists and removes watches", async () => {
    const client = new FakeClient();
    const watch = await watchAdd(client, {
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    expect(await watchList(client)).toHaveLength(1);
    expect(await watchRemove(client, watch.id)).toBe(true);
    expect(await watchList(client)).toHaveLength(0);
  });

  it("drafts a battlecard that stays in draft status (HITL)", () => {
    const draft = draftBattlecard(makeChange("w1", "high"));
    expect(draft.status).toBe("draft");
    expect(draft.body).toContain("HIGH");
    expect(draft.body).toContain("https://acme.example/pricing");
  });
});

describe("digest formatting", () => {
  it("emits 'all quiet' when nothing is material", () => {
    expect(formatDigest("Acme", [makeChange("w1", "none")])).toContain("All quiet");
  });

  it("lists material changes with citations", () => {
    const digest = formatDigest("Acme", [makeChange("w1", "high"), makeChange("w1", "low")]);
    expect(digest).toContain("[HIGH]");
    expect(digest).toContain("material change");
    expect(digest).toContain("https://acme.example/pricing");
  });
});
