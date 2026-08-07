/**
 * R2 snapshot storage (E2-3). Production binds `SNAPSHOTS` via wrangler;
 * local/tests use {@link MemoryR2Bucket}.
 */

export interface R2ObjectLike {
  key: string;
  body: string;
  uploaded: string;
}

export interface SnapshotBucket {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<R2ObjectLike | null>;
}

/** Minimal structural type for the Workers R2 binding. */
export interface R2Binding {
  put(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<{ text(): Promise<string>; uploaded?: Date } | null>;
}

/** Immutable version key: watches/{watchId}/{iso}/{contentHash}.json */
export function snapshotR2Key(watchId: string, createdAt: string, contentHash: string): string {
  const stamp = createdAt.replace(/[:.]/g, "-");
  return `watches/${watchId}/${stamp}/${contentHash}.json`;
}

export function snapshotPublicPath(r2Key: string): string {
  return `/snapshots/${encodeURIComponent(r2Key)}`;
}

export function adaptR2Binding(binding: R2Binding): SnapshotBucket {
  return {
    async put(key, value) {
      await binding.put(key, value);
    },
    async get(key) {
      const obj = await binding.get(key);
      if (!obj) return null;
      return {
        key,
        body: await obj.text(),
        uploaded: obj.uploaded?.toISOString?.() ?? new Date().toISOString(),
      };
    },
  };
}

/** In-memory R2 stand-in for hermetic tests and `wrangler`-less local runs. */
export class MemoryR2Bucket implements SnapshotBucket {
  private objects = new Map<string, R2ObjectLike>();

  async put(key: string, value: string): Promise<void> {
    this.objects.set(key, { key, body: value, uploaded: new Date().toISOString() });
  }

  async get(key: string): Promise<R2ObjectLike | null> {
    return this.objects.get(key) ?? null;
  }

  clear(): void {
    this.objects.clear();
  }

  size(): number {
    return this.objects.size;
  }
}

export const memorySnapshots = new MemoryR2Bucket();
