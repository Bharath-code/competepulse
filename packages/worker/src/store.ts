import type { ChangeEvent, PricingSnapshot, WatchLabel } from "@competepulse/core";

export interface Watch {
  id: string;
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
 * In-memory store for local development and tests. In production this is
 * backed by Cloudflare D1 (watchlists/metadata) and R2 (snapshots) per the
 * PRD; the interface is kept small so that swap is mechanical.
 */
export class MemoryStore {
  private watches = new Map<string, Watch>();
  private snapshots = new Map<string, Snapshot[]>();
  private changes = new Map<string, StoredChange[]>();

  reset(): void {
    this.watches.clear();
    this.snapshots.clear();
    this.changes.clear();
  }

  addWatch(input: { competitor: string; url: string; label: WatchLabel }): Watch {
    const watch: Watch = {
      id: crypto.randomUUID(),
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

  listWatches(): Watch[] {
    return [...this.watches.values()];
  }

  getWatch(id: string): Watch | undefined {
    return this.watches.get(id);
  }

  removeWatch(id: string): boolean {
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
}

export const store = new MemoryStore();
