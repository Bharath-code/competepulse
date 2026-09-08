import type { PlanId } from "@competepulse/core";
import type { SubscriptionStatus } from "./billing/dodo.js";
import { store, type QuietMode, type Workspace, type WorkspacePatch } from "./store.js";

export type { WorkspacePatch } from "./store.js";

/** Workspace persistence used by billing + workspace CRUD. */
export interface WorkspaceStore {
  ensureWorkspace(slackTeamId: string, plan?: PlanId): Promise<Workspace>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  listWorkspaces(): Promise<Workspace[]>;
  updateWorkspace(id: string, patch: WorkspacePatch): Promise<Workspace | undefined>;
  getWorkspaceBySubscriptionId(subscriptionId: string): Promise<Workspace | undefined>;
}

export type WorkspaceRow = {
  id: string;
  slack_team_id: string;
  plan: string;
  digest_channel_id: string | null;
  digest_cron: string;
  quiet_mode: string;
  dodo_customer_id: string | null;
  dodo_subscription_id: string | null;
  subscription_status: string;
  billing_email: string | null;
  slack_bot_token?: string | null;
  created_at: string;
};

export function workspaceFromRow(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    slackTeamId: row.slack_team_id,
    plan: row.plan as PlanId,
    digestChannelId: row.digest_channel_id,
    digestCron: row.digest_cron,
    quietMode: row.quiet_mode as QuietMode,
    dodoCustomerId: row.dodo_customer_id,
    dodoSubscriptionId: row.dodo_subscription_id,
    subscriptionStatus: row.subscription_status as SubscriptionStatus,
    billingEmail: row.billing_email,
    slackBotToken: row.slack_bot_token ?? null,
    createdAt: row.created_at,
  };
}

/** Build a parameterized UPDATE for only the provided patch keys. */
export function buildWorkspaceUpdateSql(
  patch: WorkspacePatch,
): { sql: string; values: unknown[] } | null {
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (patch.plan !== undefined) {
    assignments.push("plan = ?");
    values.push(patch.plan);
  }
  if (patch.digestChannelId !== undefined) {
    assignments.push("digest_channel_id = ?");
    values.push(patch.digestChannelId);
  }
  if (patch.quietMode !== undefined) {
    assignments.push("quiet_mode = ?");
    values.push(patch.quietMode);
  }
  if (patch.dodoCustomerId !== undefined) {
    assignments.push("dodo_customer_id = ?");
    values.push(patch.dodoCustomerId);
  }
  if (patch.dodoSubscriptionId !== undefined) {
    assignments.push("dodo_subscription_id = ?");
    values.push(patch.dodoSubscriptionId);
  }
  if (patch.subscriptionStatus !== undefined) {
    assignments.push("subscription_status = ?");
    values.push(patch.subscriptionStatus);
  }
  if (patch.billingEmail !== undefined) {
    assignments.push("billing_email = ?");
    values.push(patch.billingEmail);
  }
  if (patch.slackBotToken !== undefined) {
    assignments.push("slack_bot_token = ?");
    values.push(patch.slackBotToken);
  }

  if (assignments.length === 0) return null;
  return {
    sql: `UPDATE workspaces SET ${assignments.join(", ")} WHERE id = ?`,
    values,
  };
}

/** Workspace-only D1 adapter (unit-tested). Production product paths use {@link D1Store}. */
export class D1WorkspaceStore implements WorkspaceStore {
  constructor(private readonly db: D1Database) {}

  async ensureWorkspace(slackTeamId: string, plan: PlanId = "starter"): Promise<Workspace> {
    const existing = await this.db
      .prepare("SELECT * FROM workspaces WHERE slack_team_id = ?")
      .bind(slackTeamId)
      .first<WorkspaceRow>();
    if (existing) return workspaceFromRow(existing);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO workspaces (
          id, slack_team_id, plan, digest_cron, quiet_mode, subscription_status, created_at
        ) VALUES (?, ?, ?, '0 13 * * 1-5', 'all_quiet', 'none', ?)
        ON CONFLICT(slack_team_id) DO NOTHING`,
      )
      .bind(id, slackTeamId, plan, createdAt)
      .run();

    const row = await this.db
      .prepare("SELECT * FROM workspaces WHERE slack_team_id = ?")
      .bind(slackTeamId)
      .first<WorkspaceRow>();
    if (!row) throw new Error("failed to create workspace");
    return workspaceFromRow(row);
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM workspaces WHERE id = ?")
      .bind(id)
      .first<WorkspaceRow>();
    return row ? workspaceFromRow(row) : undefined;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM workspaces ORDER BY created_at ASC")
      .all<WorkspaceRow>();
    return results.map(workspaceFromRow);
  }

  async updateWorkspace(id: string, patch: WorkspacePatch): Promise<Workspace | undefined> {
    const built = buildWorkspaceUpdateSql(patch);
    if (!built) return this.getWorkspace(id);
    await this.db
      .prepare(built.sql)
      .bind(...built.values, id)
      .run();
    return this.getWorkspace(id);
  }

  async getWorkspaceBySubscriptionId(subscriptionId: string): Promise<Workspace | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM workspaces WHERE dodo_subscription_id = ?")
      .bind(subscriptionId)
      .first<WorkspaceRow>();
    return row ? workspaceFromRow(row) : undefined;
  }
}

/** Async facade over the in-memory MemoryStore workspace methods (tests/local dev). */
export const memoryWorkspaceStore: WorkspaceStore = {
  ensureWorkspace: async (slackTeamId, plan) => store.ensureWorkspace(slackTeamId, plan),
  getWorkspace: async (id) => store.getWorkspace(id),
  listWorkspaces: async () => store.listWorkspaces(),
  updateWorkspace: async (id, patch) => store.updateWorkspace(id, patch),
  getWorkspaceBySubscriptionId: async (subscriptionId) =>
    store.getWorkspaceBySubscriptionId(subscriptionId),
};

let cachedWs: D1WorkspaceStore | null = null;
let cachedWsDb: D1Database | null = null;

/**
 * Prefer {@link getStore} for product + billing so plan caps share one SoR.
 * This helper remains for narrow workspace-only call sites / tests.
 */
export function getWorkspaceStore(env: { DB?: D1Database }): WorkspaceStore {
  // Dynamic import avoided: callers should use getStore from get-store.ts.
  // When DB is present, D1WorkspaceStore is workspace-SQL only — billing tests
  // that need full product persistence should use getStore({ DB }).
  if (env.DB) {
    if (!cachedWs || cachedWsDb !== env.DB) {
      cachedWs = new D1WorkspaceStore(env.DB);
      cachedWsDb = env.DB;
    }
    return cachedWs;
  }
  return memoryWorkspaceStore;
}

/** Reset cached D1 workspace store (unit tests only). */
export function resetWorkspaceStoreCache(): void {
  cachedWs = null;
  cachedWsDb = null;
}
