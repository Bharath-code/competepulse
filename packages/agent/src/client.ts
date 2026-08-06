import type { StoredChange, Watch, WatchInput } from "./types.js";

/**
 * Transport the Eve agent tools use to talk to the CompetePulse Worker API.
 * Kept as an interface so tools can be unit-tested against a fake and wired to
 * the real HTTP worker in production.
 */
export interface CompetePulseClient {
  addWatch(input: WatchInput): Promise<Watch>;
  listWatches(): Promise<Watch[]>;
  removeWatch(id: string): Promise<boolean>;
  crawl(watchId: string): Promise<StoredChange>;
  getChanges(watchId: string): Promise<StoredChange[]>;
}

/** HTTP implementation targeting a running Worker (e.g. `wrangler dev`). */
export class HttpClient implements CompetePulseClient {
  constructor(private readonly baseUrl: string) {}

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      throw new Error(`Worker request ${path} failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async addWatch(input: WatchInput): Promise<Watch> {
    const { watch } = await this.json<{ watch: Watch }>("/watches", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return watch;
  }

  async listWatches(): Promise<Watch[]> {
    const { watches } = await this.json<{ watches: Watch[] }>("/watches");
    return watches;
  }

  async removeWatch(id: string): Promise<boolean> {
    const { removed } = await this.json<{ removed: boolean }>(`/watches/${id}`, {
      method: "DELETE",
    });
    return removed;
  }

  async crawl(watchId: string): Promise<StoredChange> {
    const { change } = await this.json<{ change: StoredChange }>(`/watches/${watchId}/crawl`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return change;
  }

  async getChanges(watchId: string): Promise<StoredChange[]> {
    const { changes } = await this.json<{ changes: StoredChange[] }>(`/watches/${watchId}/changes`);
    return changes;
  }
}
