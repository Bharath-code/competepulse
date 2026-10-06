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
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createOAuthState, verifyOAuthState } from "./oauth-state.js";
import {
  authorizeRequest,
  generateWorkspaceToken,
  hashToken,
  isLocal,
  planAllowsMutations,
  secretMissing,
  type Principal,
} from "./access.js";
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
import { deliverAllWorkspaceDigests, deliverWorkspaceDigest } from "./digest-deliver.js";
import { runAllWorkspaceDigests, runWorkspaceDigest } from "./digest.js";
import { getStore } from "./get-store.js";
import { crawlQueue } from "./queue.js";
import {
  adaptR2Binding,
  memorySnapshots,
  snapshotPublicPath,
  type R2Binding,
  type SnapshotBucket,
} from "./r2.js";
import { exchangeSlackOAuthCode, slackPostMessage } from "./slack-api.js";
import {
  parseInteractionPayload,
  parseSlashForm,
  slackTextResponse,
  verifySlackSignature,
} from "./slack.js";
import { encryptSecret, publicWorkspace, workspaceBotToken } from "./secrets.js";
import { CapError, store, type Store, type WorkspacePatch } from "./store.js";
import type { WorkspaceStore } from "./workspace-store.js";

export interface Env {
  /** "local" enables mock billing and open auth; anything else fails closed. */
  ENVIRONMENT?: string;
  DB?: D1Database;
  FIRECRAWL_API_KEY?: string;
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
  /** When "0"/"false", thin scrapes error instead of fixture browser (prod). */
  ALLOW_BROWSER_FIXTURES?: string;
  PUBLIC_WORKER_URL?: string;
}

const WATCH_LABELS: WatchLabel[] = ["pricing", "changelog", "docs", "careers", "other"];
const PLAN_IDS: PlanId[] = ["trial", "starter", "pro"];

function bucket(env: Env): SnapshotBucket {
  return env.SNAPSHOTS ? adaptR2Binding(env.SNAPSHOTS) : memorySnapshots;
}

function allowBrowserFixtures(env: Env): boolean {
  const v = env.ALLOW_BROWSER_FIXTURES?.toLowerCase();
  if (v === "0" || v === "false") return false;
  return true;
}

type GateCtx = {
  req: { raw: Request };
  env: Env;
  json: (body: unknown, status: 401 | 403 | 404 | 503) => Response;
};

const principals = new WeakMap<Request, Principal>();

async function requireAccess(c: GateCtx, only?: "admin") {
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

function isAdmin(c: GateCtx): boolean {
  return principals.get(c.req.raw)?.role === "admin";
}

/** The caller's own workspace, or the requested one for admins. */
function scopedWorkspaceId(c: GateCtx, requested?: string): string | undefined {
  const p = principals.get(c.req.raw);
  return p?.role === "workspace" ? (requested ?? p.workspaceId) : requested;
}

/** 404 (not 403) so a token can't probe which ids exist in other workspaces. */
function outOfScope(c: GateCtx, workspaceId: string | undefined) {
  const p = principals.get(c.req.raw);
  if (p?.role === "workspace" && p.workspaceId !== workspaceId) {
    return c.json({ error: "not found" }, 404);
  }
  return null;
}

/** Encrypts when a key is configured; plaintext only reaches here in ENVIRONMENT=local. */
function sealBotToken(token: string, env: Env): Promise<string> | string {
  return env.TOKEN_ENCRYPTION_KEY ? encryptSecret(token, env.TOKEN_ENCRYPTION_KEY) : token;
}

async function assertPlanAllows(data: Store, workspaceId: string) {
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

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  crawlQueue.setHandler(async (job) => {
    await processCrawlJob(job, { data: getStore(), bucket: memorySnapshots });
  });
  crawlQueue.setDelay(async () => {});

  app.get("/health", async (c) => {
    const data = getStore(c.env);
    return c.json({
      status: "ok",
      service: "competepulse-worker",
      watches: (await data.listWatches()).length,
      workspaces: (await data.listWorkspaces()).length,
      store: c.env.DB ? "d1" : "memory",
    });
  });

  app.get("/dashboard", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    return c.html(dashboardHtml());
  });
  app.get("/", (c) => c.redirect("/dashboard"));

  // --- Slack OAuth install (B3) ---
  app.get("/slack/install", async (c) => {
    const clientId = c.env.SLACK_CLIENT_ID;
    const clientSecret = c.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) return c.json({ error: "SLACK_CLIENT_ID not configured" }, 503);
    const { nonce, state } = await createOAuthState(clientSecret);
    setCookie(c, "cp_oauth", nonce, {
      httpOnly: true,
      secure: !isLocal(c.env),
      sameSite: "Lax",
      path: "/slack/oauth",
      maxAge: 600,
    });
    const origin = c.env.PUBLIC_WORKER_URL || new URL(c.req.url).origin;
    const redirect = `${origin}/slack/oauth/callback`;
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set(
      "scope",
      "commands,chat:write,channels:history,groups:history,im:history,app_mentions:read",
    );
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    return c.redirect(url.toString());
  });

  app.get("/slack/oauth/callback", async (c) => {
    const code = c.req.query("code");
    if (!code) return c.json({ error: "missing code" }, 400);
    const clientId = c.env.SLACK_CLIENT_ID;
    const clientSecret = c.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return c.json({ error: "Slack OAuth env not configured" }, 503);
    }
    const stateOk = await verifyOAuthState(
      clientSecret,
      c.req.query("state"),
      getCookie(c, "cp_oauth") ?? null,
    );
    deleteCookie(c, "cp_oauth", { path: "/slack/oauth" });
    if (!stateOk) return c.json({ error: "invalid_state" }, 400);
    const origin = c.env.PUBLIC_WORKER_URL || new URL(c.req.url).origin;
    const exchanged = await exchangeSlackOAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri: `${origin}/slack/oauth/callback`,
    });
    if (!exchanged.ok || !exchanged.teamId || !exchanged.botToken) {
      return c.json({ error: exchanged.error ?? "oauth_failed" }, 502);
    }
    const data = getStore(c.env);
    const workspace = await data.ensureWorkspace(exchanged.teamId, "trial");
    if (secretMissing(c.env.TOKEN_ENCRYPTION_KEY, c.env, "TOKEN_ENCRYPTION_KEY")) {
      return c.json({ error: "secret_missing" }, 503);
    }
    await data.updateWorkspace(workspace.id, {
      slackBotToken: await sealBotToken(exchanged.botToken, c.env),
    });
    const accessToken = generateWorkspaceToken();
    await data.setAccessTokenHash(workspace.id, await hashToken(accessToken));
    return c.html(
      `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
        <h1>CompetePulse installed</h1>
        <p>Workspace <code>${workspace.id}</code> linked to Slack team <code>${exchanged.teamId}</code>.</p>
        <p>Your API token (shown once, store it now): <code>${accessToken}</code></p>
        <p>Invite the bot to your digest channel, then run <code>/compete watch add …</code>.</p>
        <p><a href="/dashboard">Open dashboard</a></p>
      </body></html>`,
    );
  });

  app.post("/workspaces", async (c) => {
    const denied = await requireAccess(c, "admin");
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.slackTeamId !== "string") {
      return c.json({ error: "slackTeamId is required" }, 400);
    }
    const plan: PlanId = PLAN_IDS.includes(body.plan) ? body.plan : "starter";
    const workspace = await data.ensureWorkspace(body.slackTeamId, plan);
    const patch: WorkspacePatch = {};
    if (typeof body.digestChannelId === "string") patch.digestChannelId = body.digestChannelId;
    if (body.quietMode === "all_quiet" || body.quietMode === "skip")
      patch.quietMode = body.quietMode;
    if (PLAN_IDS.includes(body.plan)) patch.plan = body.plan;
    if (Object.keys(patch).length) await data.updateWorkspace(workspace.id, patch);
    return c.json({ workspace: publicWorkspace(await data.getWorkspace(workspace.id)) }, 201);
  });

  app.get("/workspaces", async (c) => {
    const denied = await requireAccess(c, "admin");
    if (denied) return denied;
    return c.json({
      workspaces: (await getStore(c.env).listWorkspaces()).map(publicWorkspace),
    });
  });

  app.post("/workspaces/:id/token", async (c) => {
    const denied = await requireAccess(c, "admin");
    if (denied) return denied;
    const token = generateWorkspaceToken();
    const ok = await getStore(c.env).setAccessTokenHash(c.req.param("id"), await hashToken(token));
    if (!ok) return c.json({ error: "workspace not found" }, 404);
    return c.json({ workspaceId: c.req.param("id"), token }, 201);
  });

  app.patch("/workspaces/:id", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const scoped = outOfScope(c, c.req.param("id"));
    if (scoped) return scoped;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "JSON body required" }, 400);
    const patch: WorkspacePatch = {};
    if (typeof body.digestChannelId === "string") patch.digestChannelId = body.digestChannelId;
    if (body.quietMode === "all_quiet" || body.quietMode === "skip")
      patch.quietMode = body.quietMode;
    if (isAdmin(c) && PLAN_IDS.includes(body.plan)) patch.plan = body.plan;
    if (isAdmin(c) && typeof body.slackBotToken === "string") {
      if (secretMissing(c.env.TOKEN_ENCRYPTION_KEY, c.env, "TOKEN_ENCRYPTION_KEY")) {
        return c.json({ error: "secret_missing" }, 503);
      }
      patch.slackBotToken = await sealBotToken(body.slackBotToken, c.env);
    }
    const updated = await data.updateWorkspace(c.req.param("id"), patch);
    if (!updated) return c.json({ error: "workspace not found" }, 404);
    return c.json({ workspace: publicWorkspace(updated) });
  });

  app.get("/workspaces/:id/usage", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const scoped = outOfScope(c, c.req.param("id"));
    if (scoped) return scoped;
    const data = getStore(c.env);
    const ws = await data.getWorkspace(c.req.param("id"));
    if (!ws) return c.json({ error: "workspace not found" }, 404);
    return c.json(await data.usageSummary(ws.id));
  });

  app.get("/workspaces/:id/changes", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const scoped = outOfScope(c, c.req.param("id"));
    if (scoped) return scoped;
    const data = getStore(c.env);
    const ws = await data.getWorkspace(c.req.param("id"));
    if (!ws) return c.json({ error: "workspace not found" }, 404);
    const changes = await data.listWorkspaceChanges(ws.id);
    const mapped = [];
    for (const change of changes) {
      const snap = change.toSnapshotId ? await data.getSnapshot(change.toSnapshotId) : undefined;
      mapped.push({
        ...change,
        snapshotUrl: snap ? snapshotPublicPath(snap.r2Key) : null,
      });
    }
    return c.json({ changes: mapped });
  });

  app.get("/changes/:id", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const change = await data.getChange(c.req.param("id"));
    if (!change) return c.json({ error: "change not found" }, 404);
    const owner = await data.getWatch(change.watchId);
    const scoped = outOfScope(c, owner?.workspaceId);
    if (scoped) return scoped;
    const snap = change.toSnapshotId ? await data.getSnapshot(change.toSnapshotId) : undefined;
    return c.json({
      change,
      snapshotUrl: snap ? snapshotPublicPath(snap.r2Key) : null,
    });
  });

  app.post("/watches", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.competitor !== "string" || typeof body.url !== "string") {
      return c.json({ error: "competitor and url are required" }, 400);
    }
    const label: WatchLabel = WATCH_LABELS.includes(body.label) ? body.label : "other";
    const workspaceId =
      scopedWorkspaceId(c, typeof body.workspaceId === "string" ? body.workspaceId : undefined) ??
      (await data.ensureWorkspace("local")).id;
    const scoped = outOfScope(c, workspaceId);
    if (scoped) return scoped;
    const gate = await assertPlanAllows(data, workspaceId);
    if (!gate.ok) return c.json({ error: gate.error }, gate.status);
    try {
      const watch = await data.addWatch({
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

  app.get("/watches", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const workspaceId = scopedWorkspaceId(c, c.req.query("workspaceId") ?? undefined);
    const scoped = workspaceId ? outOfScope(c, workspaceId) : null;
    if (scoped) return scoped;
    return c.json({ watches: await getStore(c.env).listWatches(workspaceId) });
  });

  app.delete("/watches/:id", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const workspaceId = scopedWorkspaceId(c, c.req.query("workspaceId") ?? undefined);
    const target = await data.getWatch(c.req.param("id"));
    const scoped = outOfScope(c, target?.workspaceId);
    if (scoped) return scoped;
    if (workspaceId) {
      const gate = await assertPlanAllows(data, workspaceId);
      if (!gate.ok) return c.json({ error: gate.error }, gate.status);
    }
    const removed = await data.removeWatch(c.req.param("id"), workspaceId);
    if (!removed) return c.json({ error: "watch not found" }, 404);
    return c.json({ removed: true });
  });

  app.post("/watches/:id/crawl", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const watch = await data.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    const scoped = outOfScope(c, watch.workspaceId);
    if (scoped) return scoped;
    const gate = await assertPlanAllows(data, watch.workspaceId);
    if (!gate.ok) return c.json({ error: gate.error }, gate.status);

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

    try {
      const outcome = await processCrawlJob(
        { ...job, attempt: 1, enqueuedAt: new Date().toISOString() },
        {
          data,
          bucket: bucket(c.env),
          apiKey: c.env.FIRECRAWL_API_KEY,
        },
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
    const denied = await requireAccess(c, "admin");
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined;
    const watches = await data.listWatches(workspaceId);
    const jobs = watches.map((w) => ({
      watchId: w.id,
      workspaceId: w.workspaceId,
      url: w.url,
      fixture: typeof body.fixture === "string" ? body.fixture : undefined,
      attempt: 1,
      enqueuedAt: new Date().toISOString(),
    }));

    if (c.env.CRAWL_QUEUE) {
      for (const job of jobs) {
        await c.env.CRAWL_QUEUE.send(job);
      }
      return c.json({ queued: jobs.length, watches: watches.length, transport: "cf_queue" });
    }

    const result = await crawlQueue.sendBatch(
      jobs.map(({ attempt: _a, enqueuedAt: _e, ...rest }) => rest),
    );
    return c.json({ ...result, watches: watches.length, transport: "memory" });
  });

  app.get("/watches/:id/changes", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const watch = await data.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    const scoped = outOfScope(c, watch.workspaceId);
    if (scoped) return scoped;
    const changes = await data.listChanges(watch.id);
    const mapped = [];
    for (const change of changes) {
      const snap = change.toSnapshotId ? await data.getSnapshot(change.toSnapshotId) : undefined;
      mapped.push({
        ...change,
        snapshotUrl: snap ? snapshotPublicPath(snap.r2Key) : null,
      });
    }
    return c.json({ changes: mapped });
  });

  app.get("/watches/:id/snapshots", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const watch = await data.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    const scoped = outOfScope(c, watch.workspaceId);
    if (scoped) return scoped;
    const snapshots = (await data.listSnapshots(watch.id)).map((s) => ({
      ...s,
      snapshotUrl: snapshotPublicPath(s.r2Key),
    }));
    return c.json({ snapshots });
  });

  app.get("/snapshots/:key", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const key = decodeURIComponent(c.req.param("key"));
    const owner = await getStore(c.env).getWatch(/^watches\/([^/]+)\//.exec(key)?.[1] ?? "");
    const scoped = outOfScope(c, owner?.workspaceId);
    if (scoped) return scoped;
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

  app.post("/qa", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.question !== "string") {
      return c.json({ error: "question is required" }, 400);
    }
    const workspaceId =
      scopedWorkspaceId(c, typeof body.workspaceId === "string" ? body.workspaceId : undefined) ??
      (await data.ensureWorkspace("local")).id;
    const scoped = outOfScope(c, workspaceId);
    if (scoped) return scoped;
    const watches = await data.listWatches(workspaceId);
    const changes = (await data.listWorkspaceChanges(workspaceId)).filter(
      (ch) => ch.materiality !== "none",
    );
    const snapshots = [];
    for (const w of watches) {
      for (const s of await data.listSnapshots(w.id)) {
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
    const result = answerFromSnapshots(body.question, { changes, snapshots });
    return c.json(result);
  });

  app.post("/battlecards", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.changeId !== "string" || typeof body.workspaceId !== "string") {
      return c.json({ error: "workspaceId and changeId are required" }, 400);
    }
    const scoped = outOfScope(c, body.workspaceId);
    if (scoped) return scoped;
    if (!isAdmin(c)) {
      const change = await data.getChange(body.changeId);
      const owner = change ? await data.getWatch(change.watchId) : undefined;
      const foreign = outOfScope(c, owner?.workspaceId);
      if (foreign) return foreign;
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
    const saved = await data.addBattlecard(draft);
    return c.json({ battlecard: saved, blocks: battlecardActionBlocks(saved) }, 201);
  });

  app.get("/battlecards/:id", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const draft = await getStore(c.env).getBattlecard(c.req.param("id"));
    if (!draft) return c.json({ error: "battlecard not found" }, 404);
    const scoped = outOfScope(c, draft.workspaceId);
    if (scoped) return scoped;
    return c.json({ battlecard: draft });
  });

  app.post("/battlecards/:id/decision", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const draft = await data.getBattlecard(c.req.param("id"));
    if (!draft) return c.json({ error: "battlecard not found" }, 404);
    const scoped = outOfScope(c, draft.workspaceId);
    if (scoped) return scoped;
    const body = await c.req.json().catch(() => null);
    if (!body || (body.decision !== "approved" && body.decision !== "rejected")) {
      return c.json({ error: "decision must be approved or rejected" }, 400);
    }
    const actor = typeof body.actor === "string" ? body.actor : "unknown";
    const next =
      body.decision === "approved"
        ? approveBattlecard(draft, actor)
        : rejectBattlecard(draft, actor);
    return c.json({ battlecard: await data.updateBattlecard(next) });
  });

  app.post("/battlecards/:id/publish", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const draft = await data.getBattlecard(c.req.param("id"));
    if (!draft) return c.json({ error: "battlecard not found" }, 404);
    const scoped = outOfScope(c, draft.workspaceId);
    if (scoped) return scoped;
    try {
      const published = publishBattlecard(draft);
      const saved = await data.updateBattlecard(published);
      const workspace = await data.getWorkspace(saved.workspaceId);
      const token = await workspaceBotToken(workspace, c.env);
      const channel = workspace?.digestChannelId;
      let slackPosted = false;
      let slackError: string | undefined;
      if (token && channel) {
        const posted = await slackPostMessage({
          token,
          channel,
          text: saved.body,
        });
        slackPosted = posted.ok;
        slackError = posted.error;
      } else {
        slackError = !token ? "missing_slack_token" : "no_digest_channel";
      }
      return c.json({ battlecard: saved, slackPosted, slackError });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 409);
    }
  });

  app.post("/digests/run", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const now =
      typeof body.now === "string" && !Number.isNaN(Date.parse(body.now))
        ? new Date(body.now)
        : new Date();
    const post = body.post !== false;
    const digestWorkspaceId = scopedWorkspaceId(
      c,
      typeof body.workspaceId === "string" ? body.workspaceId : undefined,
    );
    if (digestWorkspaceId) {
      const scoped = outOfScope(c, digestWorkspaceId);
      if (scoped) return scoped;
      const result = post
        ? await deliverWorkspaceDigest(data, digestWorkspaceId, c.env, now)
        : await runWorkspaceDigest(data, digestWorkspaceId, now);
      return c.json({ result });
    }
    const results = post
      ? await deliverAllWorkspaceDigests(data, c.env, now)
      : await runAllWorkspaceDigests(data, now);
    return c.json({ results });
  });

  app.post("/slack/commands", async (c) => {
    const rawBody = await c.req.text();
    if (secretMissing(c.env.SLACK_SIGNING_SECRET, c.env, "SLACK_SIGNING_SECRET")) {
      return c.json({ error: "secret_missing" }, 503);
    }
    const ok = await verifySlackSignature(c.env.SLACK_SIGNING_SECRET, c.req.raw, rawBody);
    if (!ok) return c.json({ error: "invalid signature" }, 401);

    const payload = parseSlashForm(rawBody);
    if (payload.command && payload.command !== "/compete") {
      return slackTextResponse(`Unsupported command \`${payload.command}\`.`);
    }

    const data = getStore(c.env);
    const workspace = await data.ensureWorkspace(payload.team_id || "local");
    if (payload.channel_id) {
      await data.setDigestChannel(workspace.id, payload.channel_id);
    }

    const client = new StoreBackedClient(data, c.env);
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
    if (secretMissing(c.env.SLACK_SIGNING_SECRET, c.env, "SLACK_SIGNING_SECRET")) {
      return c.json({ error: "secret_missing" }, 503);
    }
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

    const data = getStore(c.env);
    const draft = await data.getBattlecard(action.value);
    if (!draft) {
      return slackTextResponse("Battlecard draft not found.");
    }
    const teamId = payload.team?.id;
    const callerWorkspace = teamId ? await data.ensureWorkspace(teamId) : undefined;
    if (!callerWorkspace || callerWorkspace.id !== draft.workspaceId) {
      console.error(JSON.stringify({ event: "interaction_team_mismatch", teamId }));
      return c.json({ error: "forbidden" }, 403);
    }

    if (action.action_id === "battlecard_approve") {
      const next = approveBattlecard(draft, payload.user.id);
      await data.updateBattlecard(next);
      return slackTextResponse(
        next.status === "approved"
          ? `Approved battlecard \`${next.id}\` — use publish to pin (HITL complete).`
          : `Battlecard \`${next.id}\` is already \`${next.status}\`.`,
      );
    }

    if (action.action_id === "battlecard_reject") {
      const next = rejectBattlecard(draft, payload.user.id);
      await data.updateBattlecard(next);
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

  app.post("/billing/checkout", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.workspaceId !== "string") {
      return c.json({ error: "workspaceId is required" }, 400);
    }
    const scoped = outOfScope(c, body.workspaceId);
    if (scoped) return scoped;
    if (typeof body.plan !== "string" || !isPaidPlan(body.plan)) {
      return c.json({ error: "plan must be 'starter' or 'pro'" }, 400);
    }
    const workspace = await data.getWorkspace(body.workspaceId);
    if (!workspace) return c.json({ error: "workspace not found" }, 404);

    const plan = body.plan as PaidPlanId;
    const config = dodoConfigFromEnv(c.env);
    if (!config.apiKey && !isLocal(c.env)) {
      return c.json({ error: "billing not configured" }, 503);
    }
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
    if (!isLocal(c.env)) return c.json({ error: "not found" }, 404);
    const data = getStore(c.env);
    const workspaceId = c.req.query("workspace_id");
    const planRaw = c.req.query("plan");
    if (!workspaceId || !planRaw || !isPaidPlan(planRaw)) {
      return c.json({ error: "workspace_id and plan=starter|pro are required" }, 400);
    }
    const workspace = await data.getWorkspace(workspaceId);
    if (!workspace) return c.json({ error: "workspace not found" }, 404);

    const event = buildMockSubscriptionWebhook({
      workspaceId,
      plan: planRaw,
      email: c.req.query("email") ?? undefined,
    });
    const applied = await applyBillingEvent(data, dodoConfigFromEnv(c.env), event);
    if (c.req.header("accept")?.includes("text/html")) {
      return c.html(
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h1>CompetePulse</h1>
          <p>Mock checkout complete — workspace now on <strong>${applied.plan}</strong>.</p>
          <p><a href="/dashboard">Back to dashboard</a></p>
        </body></html>`,
      );
    }
    return c.json({
      ok: true,
      workspace: publicWorkspace(await data.getWorkspace(workspaceId)),
      event: applied,
    });
  });

  app.post("/billing/webhooks/dodo", async (c) => {
    const rawBody = await c.req.text();
    const config = dodoConfigFromEnv(c.env);
    if (secretMissing(config.webhookKey, c.env, "DODO_PAYMENTS_WEBHOOK_KEY")) {
      return c.json({ error: "secret_missing" }, 503);
    }
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

    const data = getStore(c.env);
    const webhookId = c.req.header("webhook-id");
    if (webhookId && !(await data.claimWebhook(webhookId))) {
      return c.json({ received: true, duplicate: true });
    }

    let event: DodoWebhookEvent;
    try {
      event = JSON.parse(rawBody) as DodoWebhookEvent;
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }

    const applied = await applyBillingEvent(data, config, event);
    return c.json({ received: true, ...applied });
  });

  app.get("/billing/status/:workspaceId", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const scoped = outOfScope(c, c.req.param("workspaceId"));
    if (scoped) return scoped;
    const workspace = await getStore(c.env).getWorkspace(c.req.param("workspaceId"));
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

  // silence unused in hermetic builds
  void allowBrowserFixtures;
  void store;

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

class StoreBackedClient implements CompetePulseClient {
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
