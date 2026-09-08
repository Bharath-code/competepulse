import { D1Store } from "./d1-store.js";
import { AsyncMemoryStore, store, type Store } from "./store.js";
import type { WorkspaceStore } from "./workspace-store.js";
import { resetWorkspaceStoreCache } from "./workspace-store.js";

let cachedD1: D1Store | null = null;
let cachedDb: D1Database | null = null;
const memoryProductStore = new AsyncMemoryStore(store);

/**
 * Resolve the product store for this request/isolate.
 * - With `env.DB` → durable {@link D1Store} (production / wrangler).
 * - Without → {@link AsyncMemoryStore} over the process singleton (tests/local).
 */
export function getStore(env: { DB?: D1Database } = {}): Store {
  if (env.DB) {
    if (!cachedD1 || cachedDb !== env.DB) {
      cachedD1 = new D1Store(env.DB);
      cachedDb = env.DB;
    }
    return cachedD1;
  }
  return memoryProductStore;
}

/** Billing + product share one store when DB is bound. */
export function getWorkspaceStoreUnified(env: { DB?: D1Database }): WorkspaceStore {
  return getStore(env);
}

/** Reset cached D1 product store (unit tests only). */
export function resetStoreCache(): void {
  cachedD1 = null;
  cachedDb = null;
  resetWorkspaceStoreCache();
}
