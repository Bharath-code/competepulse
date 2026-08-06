import {
  planLimits,
  UPGRADE_MESSAGE,
  type ExtractSnapshot,
  type ChangeEvent,
  type PlanId,
  type UsageMetric,
  type WatchLabel,
} from "@competepulse/core";
import type { SubscriptionStatus } from "./billing/dodo.js";

export type QuietMode = "all_quiet" | "skip";

export interface Workspace {
  id: string;
  slackTeamId: string;
  plan: PlanId;
  digestChannelId: string | null;
  digestCron: string;
  /** E3-2: all_quiet posts a single quiet line; skip omits delivery when nothing material. */
  quietMode: QuietMode;
  /** Dodo Payments customer id (E4-1). */
  dodoCustomerId: string | null;
  /** Dodo subscription id (E4-1). */
  dodoSubscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
  billingEmail: string | null;
  createdAt: string;
}

export interface Watch {
  id: string;
  workspaceId: string;
  competitor: string;
  url: string;
  label: WatchLabel;
  lastCrawlAt: string | null;
  lastSuccessAt: string | null;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  watchId: string;
  crawlRunId: string | null;
  contentHash: string;
  r2Key: string;
  extracted: ExtractSnapshot;
  markdown: string;
  createdAt: string;
}

export interface StoredChange extends ChangeEvent {
  id: string;
  watchId: string;
  fromSnapshotId?: string;
  toSnapshotId?: string;
  createdAt: string;
}

export type BattlecardStatus = "draft" | "approved" | "rejected";

export interface BattlecardDraft {
  id: string;
  workspaceId: string;
  changeId: string;
  body: string;
  status: BattlecardStatus;
  approvedBy?: string;
  approvedAt?: string;
  /** Set when an approved draft is posted/pinned to the digest channel. */
  publishedAt?: string;
  createdAt: string;
}

export interface DigestDelivery {
  id: string;
  workspaceId: string;
  deliveryDate: string;
  body: string;
  blocksJson?: string;
  createdAt: string;
}

export interface CrawlRun {
  id: string;
  watchId: string;
  workspaceId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  provider: "mock" | "firecrawl" | "browser" | null;
  attempt: number;
  error: string | null;
  costCents: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface UsageEntry {
  id: string;
  workspaceId: string;
  metric: UsageMetric;
  quantity: number;
  costCents: number;
  at: string;
  meta?: string;
}

export class CapError extends Error {
  readonly code = "PLAN_CAP_EXCEEDED";
  constructor(
    message: string,
    readonly limits = planLimits("starter"),
  ) {
    super(message);
    this.name = "CapError";
  }
}

/** Stable non-cryptographic content hash (djb2) for snapshot dedupe. */
export function contentHash(value: unknown): string {
  const json = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 33) ^ json.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * In-memory store for local development and tests. Mirrors the D1 schema so a
 * D1-backed swap stays mechanical.
 */
export class MemoryStore {
  private workspaces = new Map<string, Workspace>();
  private workspacesByTeam = new Map<string, string>();
  private watches = new Map<string, Watch>();
  private snapshots = new Map<string, Snapshot[]>();
  private changes = new Map<string, StoredChange[]>();
  private changesById = new Map<string, StoredChange>();
  private battlecards = new Map<string, BattlecardDraft>();
  private digests = new Map<string, DigestDelivery>();
  private crawlRuns = new Map<string, CrawlRun>();
  private usage: UsageEntry[] = [];
  private processedWebhooks = new Set<string>();

  reset(): void {
    this.workspaces.clear();
    this.workspacesByTeam.clear();
    this.watches.clear();
    this.snapshots.clear();
    this.changes.clear();
    this.changesById.clear();
    this.battlecards.clear();
    this.digests.clear();
    this.crawlRuns.clear();
    this.usage = [];
    this.processedWebhooks.clear();
  }

  ensureWorkspace(slackTeamId: string, plan: PlanId = "starter"): Workspace {
    const existingId = this.workspacesByTeam.get(slackTeamId);
    if (existingId) {
      const ws = this.workspaces.get(existingId);
      if (ws) return ws;
    }
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      slackTeamId,
      plan,
      digestChannelId: null,
      digestCron: "0 13 * * 1-5",
      quietMode: "all_quiet",
      dodoCustomerId: null,
      dodoSubscriptionId: null,
      subscriptionStatus: "none",
      billingEmail: null,
      createdAt: new Date().toISOString(),
    };
    this.workspaces.set(workspace.id, workspace);
    this.workspacesByTeam.set(slackTeamId, workspace.id);
    return workspace;
  }

  listWorkspaces(): Workspace[] {
    return [...this.workspaces.values()];
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  updateWorkspace(
    id: string,
    patch: Partial<
      Pick<
        Workspace,
        | "plan"
        | "digestChannelId"
        | "quietMode"
        | "dodoCustomerId"
        | "dodoSubscriptionId"
        | "subscriptionStatus"
        | "billingEmail"
      >
    >,
  ): Workspace | undefined {
    const ws = this.workspaces.get(id);
    if (!ws) return undefined;
    const updated = { ...ws, ...patch };
    this.workspaces.set(id, updated);
    return updated;
  }

  getWorkspaceBySubscriptionId(subscriptionId: string): Workspace | undefined {
    return [...this.workspaces.values()].find((w) => w.dodoSubscriptionId === subscriptionId);
  }

  /** Returns true if this webhook-id was already processed (idempotency). */
  claimWebhook(webhookId: string): boolean {
    if (this.processedWebhooks.has(webhookId)) return false;
    this.processedWebhooks.add(webhookId);
    return true;
  }

  setDigestChannel(workspaceId: string, channelId: string): Workspace | undefined {
    return this.updateWorkspace(workspaceId, { digestChannelId: channelId });
  }

  private ensureWorkspaceRecord(workspaceId: string): void {
    if (this.workspaces.has(workspaceId)) return;
    this.workspaces.set(workspaceId, {
      id: workspaceId,
      slackTeamId: workspaceId,
      plan: "starter",
      digestChannelId: null,
      digestCron: "0 13 * * 1-5",
      quietMode: "all_quiet",
      dodoCustomerId: null,
      dodoSubscriptionId: null,
      subscriptionStatus: "none",
      billingEmail: null,
      createdAt: new Date().toISOString(),
    });
    this.workspacesByTeam.set(workspaceId, workspaceId);
  }

  /**
   * Add a watch, enforcing plan competitor + URL caps (E2-6).
   * Throws {@link CapError} with an upgrade message when over limit.
   */
  addWatch(input: {
    competitor: string;
    url: string;
    label: WatchLabel;
    workspaceId?: string;
  }): Watch {
    const workspaceId = input.workspaceId ?? this.ensureWorkspace("local").id;
    this.ensureWorkspaceRecord(workspaceId);
    const workspace = this.workspaces.get(workspaceId)!;
    const limits = planLimits(workspace.plan);
    const existing = this.listWatches(workspaceId);

    if (existing.length >= limits.urlLimit) {
      throw new CapError(
        `${UPGRADE_MESSAGE} (${limits.name} allows ${limits.urlLimit} URLs; this would be #${existing.length + 1}.)`,
        limits,
      );
    }

    const competitors = new Set(existing.map((w) => w.competitor.toLowerCase()));
    const isNewCompetitor = !competitors.has(input.competitor.toLowerCase());
    if (isNewCompetitor && competitors.size >= limits.competitorLimit) {
      throw new CapError(
        `${UPGRADE_MESSAGE} (${limits.name} allows ${limits.competitorLimit} competitors.)`,
        limits,
      );
    }

    const watch: Watch = {
      id: crypto.randomUUID(),
      workspaceId,
      competitor: input.competitor,
      url: input.url,
      label: input.label,
      lastCrawlAt: null,
      lastSuccessAt: null,
      createdAt: new Date().toISOString(),
    };
    this.watches.set(watch.id, watch);
    this.snapshots.set(watch.id, []);
    this.changes.set(watch.id, []);
    return watch;
  }

  listWatches(workspaceId?: string): Watch[] {
    const all = [...this.watches.values()];
    return workspaceId ? all.filter((w) => w.workspaceId === workspaceId) : all;
  }

  getWatch(id: string): Watch | undefined {
    return this.watches.get(id);
  }

  touchWatch(id: string, success: boolean): void {
    const watch = this.watches.get(id);
    if (!watch) return;
    const now = new Date().toISOString();
    this.watches.set(id, {
      ...watch,
      lastCrawlAt: now,
      lastSuccessAt: success ? now : watch.lastSuccessAt,
    });
  }

  removeWatch(id: string, workspaceId?: string): boolean {
    const watch = this.watches.get(id);
    if (!watch) return false;
    if (workspaceId && watch.workspaceId !== workspaceId) return false;
    this.snapshots.delete(id);
    this.changes.delete(id);
    return this.watches.delete(id);
  }

  latestSnapshot(watchId: string): Snapshot | undefined {
    const list = this.snapshots.get(watchId);
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }

  listSnapshots(watchId: string): Snapshot[] {
    return this.snapshots.get(watchId) ?? [];
  }

  getSnapshot(id: string): Snapshot | undefined {
    for (const list of this.snapshots.values()) {
      const found = list.find((s) => s.id === id);
      if (found) return found;
    }
    return undefined;
  }

  addSnapshot(snapshot: Snapshot): void {
    const list = this.snapshots.get(snapshot.watchId) ?? [];
    list.push(snapshot);
    this.snapshots.set(snapshot.watchId, list);
  }

  addChange(change: StoredChange): void {
    const list = this.changes.get(change.watchId) ?? [];
    list.push(change);
    this.changes.set(change.watchId, list);
    this.changesById.set(change.id, change);
  }

  listChanges(watchId: string): StoredChange[] {
    return this.changes.get(watchId) ?? [];
  }

  listWorkspaceChanges(workspaceId: string): StoredChange[] {
    return this.listWatches(workspaceId).flatMap((w) => this.listChanges(w.id));
  }

  getChange(id: string): StoredChange | undefined {
    return this.changesById.get(id);
  }

  addBattlecard(draft: BattlecardDraft): BattlecardDraft {
    this.battlecards.set(draft.id, draft);
    return draft;
  }

  getBattlecard(id: string): BattlecardDraft | undefined {
    return this.battlecards.get(id);
  }

  updateBattlecard(draft: BattlecardDraft): BattlecardDraft {
    this.battlecards.set(draft.id, draft);
    return draft;
  }

  getDigestDelivery(workspaceId: string, deliveryDate: string): DigestDelivery | null {
    return this.digests.get(`${workspaceId}:${deliveryDate}`) ?? null;
  }

  saveDigestDelivery(input: {
    workspaceId: string;
    deliveryDate: string;
    body: string;
    blocksJson?: string;
  }): DigestDelivery {
    const key = `${input.workspaceId}:${input.deliveryDate}`;
    const existing = this.digests.get(key);
    if (existing) return existing;
    const delivery: DigestDelivery = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      deliveryDate: input.deliveryDate,
      body: input.body,
      blocksJson: input.blocksJson,
      createdAt: new Date().toISOString(),
    };
    this.digests.set(key, delivery);
    return delivery;
  }

  addCrawlRun(run: CrawlRun): CrawlRun {
    this.crawlRuns.set(run.id, run);
    return run;
  }

  updateCrawlRun(run: CrawlRun): CrawlRun {
    this.crawlRuns.set(run.id, run);
    return run;
  }

  getCrawlRun(id: string): CrawlRun | undefined {
    return this.crawlRuns.get(id);
  }

  listCrawlRuns(workspaceId?: string): CrawlRun[] {
    const all = [...this.crawlRuns.values()];
    return workspaceId ? all.filter((r) => r.workspaceId === workspaceId) : all;
  }

  recordUsage(entry: Omit<UsageEntry, "id">): UsageEntry {
    const full: UsageEntry = { ...entry, id: crypto.randomUUID() };
    this.usage.push(full);
    return full;
  }

  listUsage(workspaceId: string): UsageEntry[] {
    return this.usage.filter((u) => u.workspaceId === workspaceId);
  }

  usageSummary(workspaceId: string): {
    workspaceId: string;
    totalCostCents: number;
    byMetric: Record<string, { quantity: number; costCents: number }>;
    entries: UsageEntry[];
  } {
    const entries = this.listUsage(workspaceId);
    const byMetric: Record<string, { quantity: number; costCents: number }> = {};
    let totalCostCents = 0;
    for (const e of entries) {
      totalCostCents += e.costCents;
      const bucket = byMetric[e.metric] ?? { quantity: 0, costCents: 0 };
      bucket.quantity += e.quantity;
      bucket.costCents += e.costCents;
      byMetric[e.metric] = bucket;
    }
    return { workspaceId, totalCostCents, byMetric, entries };
  }
}

export const store = new MemoryStore();
