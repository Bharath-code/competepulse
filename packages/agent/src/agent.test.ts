import { describe, expect, it } from "vitest";
import type { CompetePulseClient } from "./client.js";
import { formatDigest } from "./digest.js";
import { runWeekdayDigest, type DigestScheduleStore } from "./schedule.js";
import { parseCompeteCommand, runCompeteCommand } from "./slash.js";
import {
  approveBattlecard,
  battlecardActionBlocks,
  draftBattlecard,
  rejectBattlecard,
  watchAdd,
  watchList,
  watchRemove,
} from "./tools.js";
import type { DigestDelivery, StoredChange, Watch, WatchInput } from "./types.js";

class FakeClient implements CompetePulseClient {
  watches = new Map<string, Watch>();
  changes: StoredChange[] = [];
  private seq = 0;

  async addWatch(input: WatchInput): Promise<Watch> {
    const watch: Watch = {
      ...input,
      id: `w${(this.seq += 1)}`,
      workspaceId: input.workspaceId ?? "ws_default",
      createdAt: "2026-08-06T00:00:00Z",
    };
    this.watches.set(watch.id, watch);
    return watch;
  }
  async listWatches(workspaceId?: string): Promise<Watch[]> {
    const all = [...this.watches.values()];
    return workspaceId ? all.filter((w) => w.workspaceId === workspaceId) : all;
  }
  async removeWatch(id: string, workspaceId?: string): Promise<boolean> {
    const watch = this.watches.get(id);
    if (!watch) return false;
    if (workspaceId && watch.workspaceId !== workspaceId) return false;
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
    createdAt: "2026-08-06T12:00:00Z",
  };
}

describe("agent tools", () => {
  it("adds, lists and removes watches", async () => {
    const client = new FakeClient();
    const watch = await watchAdd(client, {
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
      workspaceId: "ws1",
    });
    expect(await watchList(client, "ws1")).toHaveLength(1);
    expect(await watchRemove(client, watch.id, "ws1")).toBe(true);
    expect(await watchList(client, "ws1")).toHaveLength(0);
  });

  it("drafts a battlecard that stays in draft status (HITL)", () => {
    const draft = draftBattlecard(makeChange("w1", "high"), "ws1", "bc1");
    expect(draft.status).toBe("draft");
    expect(draft.body).toContain("HIGH");
    expect(draft.body).toContain("https://acme.example/pricing");
  });

  it("approves and rejects drafts via HITL transitions", () => {
    const draft = draftBattlecard(makeChange("w1", "high"), "ws1", "bc1");
    const approved = approveBattlecard(draft, "U123");
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe("U123");
    // already decided — idempotent
    expect(rejectBattlecard(approved, "U999").status).toBe("approved");

    const rejected = rejectBattlecard(draft, "U456");
    expect(rejected.status).toBe("rejected");
    expect(approveBattlecard(rejected, "U999").status).toBe("rejected");
  });

  it("emits Slack action blocks for a parked draft", () => {
    const draft = draftBattlecard(makeChange("w1", "high"), "ws1", "bc1");
    const blocks = battlecardActionBlocks(draft) as Array<Record<string, unknown>>;
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({ type: "actions", block_id: "battlecard:bc1" });
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

describe("/compete slash commands", () => {
  it("parses watch add/list/remove", () => {
    expect(parseCompeteCommand("watch add https://acme.example/pricing pricing")).toEqual({
      kind: "watch_add",
      url: "https://acme.example/pricing",
      competitor: undefined,
      label: "pricing",
    });
    expect(parseCompeteCommand("watch list")).toEqual({ kind: "watch_list" });
    expect(parseCompeteCommand("watch remove w1")).toEqual({ kind: "watch_remove", id: "w1" });
  });

  it("round-trips add → list → remove for a workspace", async () => {
    const client = new FakeClient();
    const add = parseCompeteCommand("watch add https://acme.example/pricing");
    const added = await runCompeteCommand(client, add, "team_T1");
    expect(added).toContain("Watching *Acme*");
    expect(await runCompeteCommand(client, { kind: "watch_list" }, "team_T1")).toContain("Acme");
    const id = [...client.watches.keys()][0]!;
    expect(await runCompeteCommand(client, { kind: "watch_remove", id }, "team_T1")).toContain(
      "Removed",
    );
  });
});

describe("weekday digest schedule", () => {
  it("delivers once and skips on the second call (idempotent)", async () => {
    const watches: Watch[] = [
      {
        id: "w1",
        workspaceId: "ws1",
        competitor: "Acme",
        url: "https://acme.example/pricing",
        label: "pricing",
        createdAt: "2026-08-06T00:00:00Z",
      },
    ];
    const deliveries = new Map<string, DigestDelivery>();
    const store: DigestScheduleStore = {
      async listWatches(workspaceId) {
        return watches.filter((w) => w.workspaceId === workspaceId);
      },
      async listChanges(watchId) {
        return [makeChange(watchId, "high")];
      },
      async getDigestDelivery(workspaceId, deliveryDate) {
        return deliveries.get(`${workspaceId}:${deliveryDate}`) ?? null;
      },
      async saveDigestDelivery(input) {
        const delivery: DigestDelivery = {
          id: "d1",
          createdAt: "2026-08-06T13:00:00Z",
          workspaceId: input.workspaceId,
          deliveryDate: input.deliveryDate,
          body: input.body,
        };
        deliveries.set(`${delivery.workspaceId}:${delivery.deliveryDate}`, delivery);
        return delivery;
      },
    };

    // Thursday 2026-08-06
    const first = await runWeekdayDigest(store, "ws1", {
      now: new Date("2026-08-06T13:00:00Z"),
    });
    expect(first.delivered).toBe(true);
    expect(first.body).toContain("Acme");

    const second = await runWeekdayDigest(store, "ws1", {
      now: new Date("2026-08-06T14:00:00Z"),
    });
    expect(second.skipped).toBe(true);
    expect(second.delivered).toBe(false);
    expect(deliveries.size).toBe(1);
  });

  it("idles on weekends", async () => {
    const store: DigestScheduleStore = {
      async listWatches() {
        return [];
      },
      async listChanges() {
        return [];
      },
      async getDigestDelivery() {
        return null;
      },
      async saveDigestDelivery() {
        throw new Error("should not save on weekend");
      },
    };
    const result = await runWeekdayDigest(store, "ws1", {
      now: new Date("2026-08-08T13:00:00Z"), // Saturday
    });
    expect(result.skipped).toBe(true);
    expect(result.body).toContain("Weekend");
  });
});
