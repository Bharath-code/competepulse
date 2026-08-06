import type { ChangeEvent, PricingSnapshot, WatchLabel } from "@competepulse/core";

export interface Workspace {
  id: string;
  slackTeamId: string;
  digestChannelId: string | null;
  digestCron: string;
  createdAt: string;
}

export interface Watch {
  id: string;
  workspaceId: string;
  competitor: string;
  url: string;
  label: WatchLabel;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  watchId: string;
  contentHash: string;
  extracted: PricingSnapshot;
  createdAt: string;
}

export interface StoredChange extends ChangeEvent {
  id: string;
  watchId: string;
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
  createdAt: string;
}

export interface DigestDelivery {
  id: string;
  workspaceId: string;
  deliveryDate: string;
  body: string;
  createdAt: string;
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
 * In-memory store for local development and tests. Mirrors the D1 schema in
 * `migrations/0001_init.sql` so a D1-backed swap stays mechanical (PRD E1-3).
 */
export class MemoryStore {
  private workspaces = new Map<string, Workspace>();
  private workspacesByTeam = new Map<string, string>();
  private watches = new Map<string, Watch>();
  private snapshots = new Map<string, Snapshot[]>();
  private changes = new Map<string, StoredChange[]>();
  private battlecards = new Map<string, BattlecardDraft>();
  private digests = new Map<string, DigestDelivery>();

  reset(): void {
    this.workspaces.clear();
    this.workspacesByTeam.clear();
    this.watches.clear();
    this.snapshots.clear();
    this.changes.clear();
    this.battlecards.clear();
    this.digests.clear();
  }

  ensureWorkspace(slackTeamId: string): Workspace {
    const existingId = this.workspacesByTeam.get(slackTeamId);
    if (existingId) {
      const ws = this.workspaces.get(existingId);
      if (ws) return ws;
    }
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      slackTeamId,
      digestChannelId: null,
      digestCron: "0 13 * * 1-5",
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

  setDigestChannel(workspaceId: string, channelId: string): Workspace | undefined {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return undefined;
    const updated = { ...ws, digestChannelId: channelId };
    this.workspaces.set(workspaceId, updated);
    return updated;
  }

  addWatch(input: {
    competitor: string;
    url: string;
    label: WatchLabel;
    workspaceId?: string;
  }): Watch {
    const workspaceId = input.workspaceId ?? this.ensureWorkspace("local").id;
    if (!this.workspaces.has(workspaceId)) {
      // Allow tests to pass an explicit workspace id without a prior ensure.
      this.workspaces.set(workspaceId, {
        id: workspaceId,
        slackTeamId: workspaceId,
        digestChannelId: null,
        digestCron: "0 13 * * 1-5",
        createdAt: new Date().toISOString(),
      });
      this.workspacesByTeam.set(workspaceId, workspaceId);
    }
    const watch: Watch = {
      id: crypto.randomUUID(),
      workspaceId,
      competitor: input.competitor,
      url: input.url,
      label: input.label,
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

  addSnapshot(snapshot: Snapshot): void {
    const list = this.snapshots.get(snapshot.watchId) ?? [];
    list.push(snapshot);
    this.snapshots.set(snapshot.watchId, list);
  }

  addChange(change: StoredChange): void {
    const list = this.changes.get(change.watchId) ?? [];
    list.push(change);
    this.changes.set(change.watchId, list);
  }

  listChanges(watchId: string): StoredChange[] {
    return this.changes.get(watchId) ?? [];
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
  }): DigestDelivery {
    const key = `${input.workspaceId}:${input.deliveryDate}`;
    const existing = this.digests.get(key);
    if (existing) return existing;
    const delivery: DigestDelivery = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      deliveryDate: input.deliveryDate,
      body: input.body,
      createdAt: new Date().toISOString(),
    };
    this.digests.set(key, delivery);
    return delivery;
  }
}

export const store = new MemoryStore();
