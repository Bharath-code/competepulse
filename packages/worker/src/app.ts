import {
  answerFromSnapshots,
  approveBattlecard,
  battlecardActionBlocks,
  draftBattlecard,
  parseCompeteCommand,
  publishBattlecard,
  rejectBattlecard,
  runCompeteCommand,
  type BattlecardDraft as AgentBattlecard,
  type CompetePulseClient,
  type QaClientResult,
} from "@competepulse/agent";
import {
  diffPricing,
  isPaidPlan,
  planLimits,
  type PaidPlanId,
  type PlanId,
  type WatchLabel,
} from "@competepulse/core";
import { Hono } from "hono";
import {
  applyDodoWebhookEvent,
  buildMockSubscriptionWebhook,
  createCheckoutSession,
  dodoConfigFromEnv,
  verifyDodoWebhook,
  type DodoWebhookEvent,
} from "./billing/dodo.js";
import { processCrawlJob } from "./crawl.js";
import { dashboardHtml } from "./dashboard.js";
import { runAllWorkspaceDigests, runWorkspaceDigest } from "./digest.js";
import { crawlQueue } from "./queue.js";
import {
  adaptR2Binding,
  memorySnapshots,
  snapshotPublicPath,
  type R2Binding,
  type SnapshotBucket,
} from "./r2.js";
import {
  parseInteractionPayload,
  parseSlashForm,
  slackTextResponse,
  verifySlackSignature,
} from "./slack.js";
import { CapError, store } from "./store.js";
import {
  getWorkspaceStore,
  type WorkspacePatch,
  type WorkspaceStore,
} from "./workspace-store.js";

export interface Env {
  DB?: D1Database;
  FIRECRAWL_API_KEY?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_BOT_TOKEN?: string;
  SNAPSHOTS?: R2Binding;
  CRAWL_QUEUE?: { send(body: unknown): Promise<void> };
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PAYMENTS_ENVIRONMENT?: string;
  DODO_PRODUCT_STARTER?: string;
  DODO_PRODUCT_PRO?: string;
  DODO_PAYMENTS_RETURN_URL?: string;
}

const WATCH_LABELS: WatchLabel[] = ["pricing", "changelog", "docs", "careers", "other"];
const PLAN_IDS: PlanId[] = ["trial", "starter", "pro"];

function bucket(env: Env): SnapshotBucket {
  return env.SNAPSHOTS ? adaptR2Binding(env.SNAPSHOTS) : memorySnapshots;
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // Wire the in-memory queue consumer once (E2-1).
  crawlQueue.setHandler(async (job) => {
    await processCrawlJob(job, { data: store, bucket: memorySnapshots });
  });
  crawlQueue.setDelay(async () => {
    /* no-op delay in request path; retries still count attempts */
  });

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "competepulse-worker",
      watches: store.listWatches().length,
      workspaces: store.listWorkspaces().length,
    }),
  );

  app.get("/dashboard", (c) => c.html(dashboardHtml()));
  app.get("/", (c) => c.redirect("/dashboard"));

  app.post("/workspaces", async (c) => {
    const wsStore = getWorkspaceStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.slackTeamId !== "string") {
      return c.json({ error: "slackTeamId is required" }, 400);
    }
    const plan: PlanId = PLAN_IDS.includes(body.plan) ? body.plan : "starter";
    const workspace = await wsStore.ensureWorkspace(body.slackTeamId, plan);
    const patch: WorkspacePatch = {};
    if (typeof body.digestChannelId === "string") patch.digestChannelId = body.digestChannelId;
    if (body.quietMode === "all_quiet" || body.quietMode === "skip")
      patch.quietMode = body.quietMode;
    if (PLAN_IDS.includes(body.plan)) patch.plan = body.plan;
    if (Object.keys(patch).length) await wsStore.updateWorkspace(workspace.id, patch);
    return c.json({ workspace: await wsStore.getWorkspace(workspace.id) }, 201);
  });

  app.get("/workspaces", async (c) =>
    c.json({ workspaces: await getWorkspaceStore(c.env).listWorkspaces() }),
  );

  app.patch("/workspaces/:id", async (c) => {
    const wsStore = getWorkspaceStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "JSON body required" }, 400);
    const patch: WorkspacePatch = {};
    if (typeof body.digestChannelId === "string") patch.digestChannelId = body.digestChannelId;
    if (body.quietMode === "all_quiet" || body.quietMode === "skip")
      patch.quietMode = body.quietMode;
    if (PLAN_IDS.includes(body.plan)) patch.plan = body.plan;
    const updated = await wsStore.updateWorkspace(c.req.param("id"), patch);
    if (!updated) return c.json({ error: "workspace not found" }, 404);
    return c.json({ workspace: updated });
  });

  app.get("/workspaces/:id/usage", async (c) => {
    const ws = await getWorkspaceStore(c.env).getWorkspace(c.req.param("id"));
    if (!ws) return c.json({ error: "workspace not found" }, 404);
    return c.json(store.usageSummary(ws.id));
  });

  app.get("/workspaces/:id/changes", async (c) => {
    const ws = await getWorkspaceStore(c.env).getWorkspace(c.req.param("id"));
    if (!ws) return c.json({ error: "workspace not found" }, 404);
    const changes = store.listWorkspaceChanges(ws.id).map((change) => {
      const snap = change.toSnapshotId ? store.getSnapshot(change.toSnapshotId) : undefined;
      return {
        ...change,
        snapshotUrl: snap ? snapshotPublicPath(snap.r2Key) : null,
      };
    });
    return c.json({ changes });
  });

  app.get("/changes/:id", (c) => {
    const change = store.getChange(c.req.param("id"));
    if (!change) return c.json({ error: "change not found" }, 404);
    const snap = change.toSnapshotId ? store.getSnapshot(change.toSnapshotId) : undefined;
    return c.json({
      change,
      snapshot: snap ?? null,
      snapshotUrl: snap ? snapshotPublicPath(snap.r2Key) : null,
    });
  });

  app.post("/watches", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.competitor !== "string" || typeof body.url !== "string") {
      return c.json({ error: "competitor and url are required" }, 400);
    }
    const label: WatchLabel = WATCH_LABELS.includes(body.label) ? body.label : "other";
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : store.ensureWorkspace("local").id;
    try {
      const watch = store.addWatch({
        competitor: body.competitor,
        url: body.url,
        label,
        workspaceId,
      });
      return c.json({ watch }, 201);
    } catch (err) {
      if (err instanceof CapError) {
        return c.json({ error: err.message, code: err.code, limits: err.limits }, 402);
      }
      throw err;
    }
  });

  app.get("/watches", (c) => {
    const workspaceId = c.req.query("workspaceId") ?? undefined;
    return c.json({ watches: store.listWatches(workspaceId) });
  });

  app.delete("/watches/:id", (c) => {
    const workspaceId = c.req.query("workspaceId") ?? undefined;
    const removed = store.removeWatch(c.req.param("id"), workspaceId);
    if (!removed) return c.json({ error: "watch not found" }, 404);
    return c.json({ removed: true });
  });

  // Enqueue crawl onto the queue (E2-1). `?sync=1` or fixture body still
  // processes inline for local demos/tests.
  app.post("/watches/:id/crawl", async (c) => {
    const watch = store.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);

    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const fixture = typeof body.fixture === "string" ? body.fixture : undefined;
    const sync = c.req.query("sync") === "1" || fixture !== undefined || !c.env.CRAWL_QUEUE;

    const job = {
      watchId: watch.id,
      workspaceId: watch.workspaceId,
      url: watch.url,
      fixture,
    };

    if (!sync && c.env.CRAWL_QUEUE) {
      await c.env.CRAWL_QUEUE.send({ ...job, attempt: 1, enqueuedAt: new Date().toISOString() });
      return c.json({ queued: true, watchId: watch.id }, 202);
    }

    // Local / test path: use in-memory queue (retries) then return outcome.
    try {
      const outcome = await processCrawlJob(
        { ...job, attempt: 1, enqueuedAt: new Date().toISOString() },
        { data: store, bucket: bucket(c.env), apiKey: c.env.FIRECRAWL_API_KEY },
      );
      return c.json({
        provider: outcome.provider,
        snapshot: outcome.snapshot,
        change: outcome.change,
        snapshotUrl: outcome.snapshotUrl,
        run: outcome.run,
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  app.post("/queues/crawl/fanout", async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined;
    const watches = store.listWatches(workspaceId);
    const jobs = watches.map((w) => ({
      watchId: w.id,
      workspaceId: w.workspaceId,
      url: w.url,
      fixture: typeof body.fixture === "string" ? body.fixture : undefined,
    }));
    const result = await crawlQueue.sendBatch(jobs);
    return c.json({ ...result, watches: watches.length });
  });

  app.get("/watches/:id/changes", (c) => {
    const watch = store.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    const changes = store.listChanges(watch.id).map((change) => {
      const snap = change.toSnapshotId ? store.getSnapshot(change.toSnapshotId) : undefined;
      return { ...change, snapshotUrl: snap ? snapshotPublicPath(snap.r2Key) : null };
    });
    return c.json({ changes });
  });

  app.get("/watches/:id/snapshots", (c) => {
    const watch = store.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    const snapshots = store.listSnapshots(watch.id).map((s) => ({
      ...s,
      snapshotUrl: snapshotPublicPath(s.r2Key),
    }));
    return c.json({ snapshots });
  });

  app.get("/snapshots/:key", async (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const obj = await bucket(c.env).get(key);
    if (!obj) return c.json({ error: "snapshot not found" }, 404);
    return c.json(JSON.parse(obj.body));
  });

  app.post("/diff", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.to !== "object" || body.to === null) {
      return c.json({ error: "'to' pricing snapshot is required" }, 400);
    }
    const url = typeof body.url === "string" ? body.url : "about:blank";
    const event = diffPricing(body.from ?? null, body.to, url);
    return c.json({ change: event });
  });

  // Thread Q&A grounded in snapshots/changes (E3-3)
  app.post("/qa", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.question !== "string") {
      return c.json({ error: "question is required" }, 400);
    }
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : store.ensureWorkspace("local").id;
    const watches = store.listWatches(workspaceId);
    const changes = store
      .listWorkspaceChanges(workspaceId)
      .filter((ch) => ch.materiality !== "none");
    const snapshots = watches.flatMap((w) =>
      store.listSnapshots(w.id).map((s) => ({
        id: s.id,
        watchId: w.id,
        competitor: w.competitor,
        url: w.url,
        summaryHints: [JSON.stringify(s.extracted)],
        r2Key: s.r2Key,
        snapshotUrl: snapshotPublicPath(s.r2Key),
      })),
    );
    const result = answerFromSnapshots(body.question, { changes, snapshots });
    return c.json(result);
  });

  // --- Battlecards (E1-5 / E3-4 HITL) ---

  app.post("/battlecards", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.changeId !== "string" || typeof body.workspaceId !== "string") {
      return c.json({ error: "workspaceId and changeId are required" }, 400);
    }
    const draft: AgentBattlecard =
      typeof body.body === "string" && typeof body.id === "string"
        ? {
            id: body.id,
            workspaceId: body.workspaceId,
            changeId: body.changeId,
            body: body.body,
            status: "draft",
            createdAt: new Date().toISOString(),
          }
        : draftBattlecard(
            {
              id: body.changeId,
              watchId: typeof body.watchId === "string" ? body.watchId : "",
              materiality: body.materiality ?? "high",
              summary: body.summary ?? "Competitive update",
              findings: [],
              citations: Array.isArray(body.citations) ? body.citations : [],
              createdAt: new Date().toISOString(),
            },
            body.workspaceId,
          );
    const saved = store.addBattlecard(draft);
    return c.json({ battlecard: saved, blocks: battlecardActionBlocks(saved) }, 201);
  });

  app.get("/battlecards/:id", (c) => {
    const draft = store.getBattlecard(c.req.param("id"));
    if (!draft) return c.json({ error: "battlecard not found" }, 404);
    return c.json({ battlecard: draft });
  });

  app.post("/battlecards/:id/decision", async (c) => {
    const draft = store.getBattlecard(c.req.param("id"));
    if (!draft) return c.json({ error: "battlecard not found" }, 404);
    const body = await c.req.json().catch(() => null);
    if (!body || (body.decision !== "approved" && body.decision !== "rejected")) {
      return c.json({ error: "decision must be approved or rejected" }, 400);
    }
    const actor = typeof body.actor === "string" ? body.actor : "unknown";
    const next =
      body.decision === "approved"
        ? approveBattlecard(draft, actor)
        : rejectBattlecard(draft, actor);
    return c.json({ battlecard: store.updateBattlecard(next) });
  });

  app.post("/battlecards/:id/publish", async (c) => {
    const draft = store.getBattlecard(c.req.param("id"));
    if (!draft) return c.json({ error: "battlecard not found" }, 404);
    try {
      const published = publishBattlecard(draft);
      return c.json({ battlecard: store.updateBattlecard(published) });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 409);
    }
  });

  // --- Digests (E1-4 / E3-1 / E3-2) ---

  app.post("/digests/run", async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const now =
      typeof body.now === "string" && !Number.isNaN(Date.parse(body.now))
        ? new Date(body.now)
        : new Date();
    if (typeof body.workspaceId === "string") {
      return c.json({ result: runWorkspaceDigest(store, body.workspaceId, now) });
    }
    return c.json({ results: runAllWorkspaceDigests(store, now) });
  });

  // --- Slack (E1-2 / E1-3 / E1-5) ---

  app.post("/slack/commands", async (c) => {
    const rawBody = await c.req.text();
    const ok = await verifySlackSignature(c.env.SLACK_SIGNING_SECRET, c.req.raw, rawBody);
    if (!ok) return c.json({ error: "invalid signature" }, 401);

    const payload = parseSlashForm(rawBody);
    if (payload.command && payload.command !== "/compete") {
      return slackTextResponse(`Unsupported command \`${payload.command}\`.`);
    }

    const workspace = store.ensureWorkspace(payload.team_id || "local");
    if (payload.channel_id) {
      store.setDigestChannel(workspace.id, payload.channel_id);
    }

    const client = new StoreBackedClient();
    const command = parseCompeteCommand(payload.text);
    try {
      const text = await runCompeteCommand(client, command, workspace.id);
      return slackTextResponse(text);
    } catch (err) {
      if (err instanceof CapError) return slackTextResponse(err.message);
      throw err;
    }
  });

  app.post("/slack/interactions", async (c) => {
    const rawBody = await c.req.text();
    const ok = await verifySlackSignature(c.env.SLACK_SIGNING_SECRET, c.req.raw, rawBody);
    if (!ok) return c.json({ error: "invalid signature" }, 401);

    let payload;
    try {
      payload = parseInteractionPayload(rawBody);
    } catch {
      return c.json({ error: "invalid payload" }, 400);
    }

    const action = payload.actions?.[0];
    if (!action) return c.json({ ok: true });

    const draft = store.getBattlecard(action.value);
    if (!draft) {
      return slackTextResponse("Battlecard draft not found.");
    }

    if (action.action_id === "battlecard_approve") {
      const next = approveBattlecard(draft, payload.user.id);
      store.updateBattlecard(next);
      return slackTextResponse(
        next.status === "approved"
          ? `Approved battlecard \`${next.id}\` — use publish to pin (HITL complete).`
          : `Battlecard \`${next.id}\` is already \`${next.status}\`.`,
      );
    }

    if (action.action_id === "battlecard_reject") {
      const next = rejectBattlecard(draft, payload.user.id);
      store.updateBattlecard(next);
      return slackTextResponse(
        next.status === "rejected"
          ? `Rejected battlecard \`${next.id}\`.`
          : `Battlecard \`${next.id}\` is already \`${next.status}\`.`,
      );
    }

    return slackTextResponse("Unknown action.");
  });

  app.get("/meta/plans", (c) =>
    c.json({
      plans: ["trial", "starter", "pro"].map((p) => planLimits(p as PlanId)),
      billingProvider: "dodopayments",
    }),
  );

  // --- Billing (E4-1 Dodo Payments) ---

  app.post("/billing/checkout", async (c) => {
    const wsStore = getWorkspaceStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.workspaceId !== "string") {
      return c.json({ error: "workspaceId is required" }, 400);
    }
    if (typeof body.plan !== "string" || !isPaidPlan(body.plan)) {
      return c.json({ error: "plan must be 'starter' or 'pro'" }, 400);
    }
    const workspace = await wsStore.getWorkspace(body.workspaceId);
    if (!workspace) return c.json({ error: "workspace not found" }, 404);

    const plan = body.plan as PaidPlanId;
    const config = dodoConfigFromEnv(c.env);
    const origin = new URL(c.req.url).origin;

    try {
      const session = await createCheckoutSession(config, {
        workspaceId: workspace.id,
        plan,
        email: typeof body.email === "string" ? body.email : (workspace.billingEmail ?? undefined),
        name: typeof body.name === "string" ? body.name : undefined,
        origin,
      });
      return c.json({
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        mock: session.mock,
        plan: session.plan,
        workspaceId: session.workspaceId,
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
  });

  app.get("/billing/mock-complete", async (c) => {
    // Local/dev path when DODO_PAYMENTS_API_KEY is unset.
    const wsStore = getWorkspaceStore(c.env);
    const workspaceId = c.req.query("workspace_id");
    const planRaw = c.req.query("plan");
    if (!workspaceId || !planRaw || !isPaidPlan(planRaw)) {
      return c.json({ error: "workspace_id and plan=starter|pro are required" }, 400);
    }
    const workspace = await wsStore.getWorkspace(workspaceId);
    if (!workspace) return c.json({ error: "workspace not found" }, 404);

    const event = buildMockSubscriptionWebhook({
      workspaceId,
      plan: planRaw,
      email: c.req.query("email") ?? undefined,
    });
    const applied = await applyBillingEvent(wsStore, dodoConfigFromEnv(c.env), event);
    if (c.req.header("accept")?.includes("text/html")) {
      return c.html(
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h1>CompetePulse</h1>
          <p>Mock checkout complete — workspace now on <strong>${applied.plan}</strong>.</p>
          <p><a href="/dashboard">Back to dashboard</a></p>
        </body></html>`,
      );
    }
    return c.json({ ok: true, workspace: await wsStore.getWorkspace(workspaceId), event: applied });
  });

  app.post("/billing/webhooks/dodo", async (c) => {
    const rawBody = await c.req.text();
    const config = dodoConfigFromEnv(c.env);
    const verified = await verifyDodoWebhook(
      rawBody,
      {
        id: c.req.header("webhook-id") ?? null,
        timestamp: c.req.header("webhook-timestamp") ?? null,
        signature: c.req.header("webhook-signature") ?? null,
      },
      config.webhookKey,
    );
    if (!verified.ok) {
      return c.json({ error: verified.error }, 401);
    }

    const webhookId = c.req.header("webhook-id");
    if (webhookId && !store.claimWebhook(webhookId)) {
      return c.json({ received: true, duplicate: true });
    }

    let event: DodoWebhookEvent;
    try {
      event = JSON.parse(rawBody) as DodoWebhookEvent;
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }

    const applied = await applyBillingEvent(getWorkspaceStore(c.env), config, event);
    return c.json({ received: true, ...applied });
  });

  app.get("/billing/status/:workspaceId", async (c) => {
    const workspace = await getWorkspaceStore(c.env).getWorkspace(c.req.param("workspaceId"));
    if (!workspace) return c.json({ error: "workspace not found" }, 404);
    return c.json({
      workspaceId: workspace.id,
      plan: workspace.plan,
      limits: planLimits(workspace.plan),
      subscriptionStatus: workspace.subscriptionStatus,
      dodoCustomerId: workspace.dodoCustomerId,
      dodoSubscriptionId: workspace.dodoSubscriptionId,
      billingEmail: workspace.billingEmail,
      provider: "dodopayments",
    });
  });

  return app;
}

async function applyBillingEvent(
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
    // Unknown workspace id — ignore quietly so Dodo retries don't loop forever.
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

/**
 * In-process client so Slack slash commands hit the same MemoryStore without
 * an HTTP round-trip (keeps worker tests hermetic).
 */
class StoreBackedClient implements CompetePulseClient {
  async addWatch(input: {
    competitor: string;
    url: string;
    label: WatchLabel;
    workspaceId?: string;
  }) {
    return store.addWatch(input);
  }
  async listWatches(workspaceId?: string) {
    return store.listWatches(workspaceId);
  }
  async removeWatch(id: string, workspaceId?: string) {
    return store.removeWatch(id, workspaceId);
  }
  async crawl(watchId: string) {
    const watch = store.getWatch(watchId);
    if (!watch) throw new Error("watch not found");
    const outcome = await processCrawlJob(
      {
        watchId,
        workspaceId: watch.workspaceId,
        url: watch.url,
        attempt: 1,
        enqueuedAt: new Date().toISOString(),
      },
      { data: store, bucket: memorySnapshots },
    );
    return outcome.change;
  }
  async getChanges(watchId: string) {
    return store.listChanges(watchId);
  }
  async ask(question: string, workspaceId: string): Promise<QaClientResult> {
    const watches = store.listWatches(workspaceId);
    const changes = store
      .listWorkspaceChanges(workspaceId)
      .filter((ch) => ch.materiality !== "none");
    const snapshots = watches.flatMap((w) =>
      store.listSnapshots(w.id).map((s) => ({
        id: s.id,
        watchId: w.id,
        competitor: w.competitor,
        url: w.url,
        summaryHints: [JSON.stringify(s.extracted)],
        r2Key: s.r2Key,
        snapshotUrl: snapshotPublicPath(s.r2Key),
      })),
    );
    return answerFromSnapshots(question, { changes, snapshots });
  }
}
