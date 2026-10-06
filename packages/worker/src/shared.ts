import type { AnalyticsEnv } from "./analytics.js";
import type { MonitorProvider } from "./monitor.js";
import {
  answerFromSnapshots,
  type CompetePulseClient,
  type QaClientResult,
} from "@competepulse/agent";
import { type PlanId, type WatchLabel } from "@competepulse/core";
import { authorizeRequest, isLocal, planAllowsMutations, type Principal } from "./access.js";
import { applyDodoWebhookEvent, dodoConfigFromEnv, type DodoWebhookEvent } from "./billing/dodo.js";
import { processCrawlJob } from "./crawl.js";
import { getStore } from "./get-store.js";
import {
  adaptR2Binding,
  memorySnapshots,
  snapshotPublicPath,
  type R2Binding,
  type SnapshotBucket,
} from "./r2.js";
import { encryptSecret } from "./secrets.js";
import { CapError, type Store, type WorkspacePatch } from "./store.js";
import type { WorkspaceStore } from "./workspace-store.js";

export interface Env extends AnalyticsEnv {
  /** "local" enables mock billing and open auth; anything else fails closed. */
  ENVIRONMENT?: string;
  DB?: D1Database;
  FIRECRAWL_API_KEY?: string;
  /** Shared secret Firecrawl echoes back as `Authorization: Bearer` on monitor webhooks. */
  FIRECRAWL_WEBHOOK_SECRET?: string;
  /** Local-only seam: stands in for the Firecrawl monitor API in tests. */
  monitorProvider?: MonitorProvider;
  SLACK_SIGNING_SECRET?: string;
  /** Base64 32-byte AES-GCM key for Slack bot tokens at rest. */
  TOKEN_ENCRYPTION_KEY?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  SNAPSHOTS?: R2Binding;
  CRAWL_QUEUE?: { send(body: unknown): Promise<void>; sendBatch?(msgs: unknown[]): Promise<void> };
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PAYMENTS_ENVIRONMENT?: string;
  DODO_PRODUCT_STARTER?: string;
  DODO_PRODUCT_PRO?: string;
  DODO_PAYMENTS_RETURN_URL?: string;
  DASHBOARD_ACCESS_TOKEN?: string;
  FOUNDER_ALERT_WEBHOOK?: string;
  PUBLIC_WORKER_URL?: string;
}

export const WATCH_LABELS: WatchLabel[] = ["pricing", "changelog", "docs", "careers", "other"];
export const PLAN_IDS: PlanId[] = ["trial", "starter", "pro"];

export function bucket(env: Env): SnapshotBucket {
  return env.SNAPSHOTS ? adaptR2Binding(env.SNAPSHOTS) : memorySnapshots;
}

export type GateCtx = {
  req: { raw: Request };
  env: Env;
  json: (body: unknown, status: 401 | 403 | 404 | 503) => Response;
};

const principals = new WeakMap<Request, Principal>();

export async function requireAccess(c: GateCtx, only?: "admin") {
  const auth = await authorizeRequest(c.req.raw, c.env, (h) =>
    getStore(c.env).getWorkspaceByAccessTokenHash(h),
  );
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  principals.set(c.req.raw, auth.principal);
  if (only === "admin" && auth.principal.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}

export function isAdmin(c: GateCtx): boolean {
  return principals.get(c.req.raw)?.role === "admin";
}

/** The caller's own workspace, or the requested one for admins. */
export function scopedWorkspaceId(c: GateCtx, requested?: string): string | undefined {
  const p = principals.get(c.req.raw);
  return p?.role === "workspace" ? (requested ?? p.workspaceId) : requested;
}

/** 404 (not 403) so a token can't probe which ids exist in other workspaces. */
export function outOfScope(c: GateCtx, workspaceId: string | undefined) {
  const p = principals.get(c.req.raw);
  if (p?.role === "workspace" && p.workspaceId !== workspaceId) {
    return c.json({ error: "not found" }, 404);
  }
  return null;
}

/** Encrypts when a key is configured; plaintext only reaches here in ENVIRONMENT=local. */
export function sealBotToken(token: string, env: Env): Promise<string> | string {
  return env.TOKEN_ENCRYPTION_KEY ? encryptSecret(token, env.TOKEN_ENCRYPTION_KEY) : token;
}

export async function assertPlanAllows(data: Store, workspaceId: string) {
  const ws = await data.getWorkspace(workspaceId);
  if (!ws) return { ok: false as const, status: 404 as const, error: "workspace not found" };
  if (!planAllowsMutations(ws.subscriptionStatus, ws.plan)) {
    return {
      ok: false as const,
      status: 402 as const,
      error: `Plan/status '${ws.plan}/${ws.subscriptionStatus}' cannot mutate watches. Upgrade or reactivate billing.`,
    };
  }
  return { ok: true as const, workspace: ws };
}

export async function applyBillingEvent(
  wsStore: WorkspaceStore,
  config: ReturnType<typeof dodoConfigFromEnv>,
  event: DodoWebhookEvent,
) {
  const applied = applyDodoWebhookEvent(config, event);

  const workspace =
    (applied.workspaceId ? await wsStore.getWorkspace(applied.workspaceId) : undefined) ??
    (applied.subscriptionId
      ? await wsStore.getWorkspaceBySubscriptionId(applied.subscriptionId)
      : undefined);

  if (!workspace && !applied.handled) {
    return applied;
  }

  if (!workspace && applied.workspaceId) {
    return { ...applied, workspaceId: applied.workspaceId };
  }

  if (workspace && applied.handled) {
    const patch: WorkspacePatch = {
      subscriptionStatus: applied.status,
    };
    if (applied.plan) patch.plan = applied.plan;
    if (applied.subscriptionId) patch.dodoSubscriptionId = applied.subscriptionId;
    if (applied.customerId) patch.dodoCustomerId = applied.customerId;
    if (applied.email) patch.billingEmail = applied.email;
    await wsStore.updateWorkspace(workspace.id, patch);
    return { ...applied, workspaceId: workspace.id };
  }

  return applied;
}

export class StoreBackedClient implements CompetePulseClient {
  constructor(
    private readonly data: Store,
    private readonly env: Env,
  ) {}

  async addWatch(input: {
    competitor: string;
    url: string;
    label: WatchLabel;
    workspaceId?: string;
  }) {
    if (input.workspaceId) {
      const gate = await assertPlanAllows(this.data, input.workspaceId);
      if (!gate.ok) throw new CapError(gate.error);
    }
    return this.data.addWatch(input);
  }
  async listWatches(workspaceId?: string) {
    return this.data.listWatches(workspaceId);
  }
  async removeWatch(id: string, workspaceId?: string) {
    return this.data.removeWatch(id, workspaceId);
  }
  async crawl(watchId: string) {
    const watch = await this.data.getWatch(watchId);
    if (!watch) throw new Error("watch not found");
    const outcome = await processCrawlJob(
      {
        watchId,
        workspaceId: watch.workspaceId,
        url: watch.url,
        attempt: 1,
        enqueuedAt: new Date().toISOString(),
      },
      {
        data: this.data,
        bucket: bucket(this.env),
        apiKey: this.env.FIRECRAWL_API_KEY,
        allowFixtures: isLocal(this.env),
      },
    );
    return outcome.change;
  }
  async getChanges(watchId: string) {
    return this.data.listChanges(watchId);
  }
  async ask(question: string, workspaceId: string): Promise<QaClientResult> {
    const watches = await this.data.listWatches(workspaceId);
    const changes = (await this.data.listWorkspaceChanges(workspaceId)).filter(
      (ch) => ch.materiality !== "none",
    );
    const snapshots = [];
    for (const w of watches) {
      for (const s of await this.data.listSnapshots(w.id)) {
        snapshots.push({
          id: s.id,
          watchId: w.id,
          competitor: w.competitor,
          url: w.url,
          summaryHints: [JSON.stringify(s.extracted)],
          r2Key: s.r2Key,
          snapshotUrl: snapshotPublicPath(s.r2Key),
        });
      }
    }
    return answerFromSnapshots(question, { changes, snapshots });
  }
}
