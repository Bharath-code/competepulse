import {
  approveBattlecard,
  battlecardActionBlocks,
  draftBattlecard,
  parseCompeteCommand,
  rejectBattlecard,
  runCompeteCommand,
  type BattlecardDraft as AgentBattlecard,
  type CompetePulseClient,
} from "@competepulse/agent";
import { diffPricing, type WatchLabel } from "@competepulse/core";
import { Hono } from "hono";
import { runAllWorkspaceDigests, runWorkspaceDigest } from "./digest.js";
import { scrape } from "./scrape.js";
import {
  parseInteractionPayload,
  parseSlashForm,
  slackTextResponse,
  verifySlackSignature,
} from "./slack.js";
import { contentHash, store, type Snapshot, type StoredChange } from "./store.js";

export interface Env {
  FIRECRAWL_API_KEY?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_BOT_TOKEN?: string;
}

const WATCH_LABELS: WatchLabel[] = ["pricing", "changelog", "docs", "careers", "other"];

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "competepulse-worker",
      watches: store.listWatches().length,
      workspaces: store.listWorkspaces().length,
    }),
  );

  app.post("/workspaces", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.slackTeamId !== "string") {
      return c.json({ error: "slackTeamId is required" }, 400);
    }
    const workspace = store.ensureWorkspace(body.slackTeamId);
    if (typeof body.digestChannelId === "string") {
      store.setDigestChannel(workspace.id, body.digestChannelId);
    }
    return c.json({ workspace: store.getWorkspace(workspace.id) }, 201);
  });

  app.get("/workspaces", (c) => c.json({ workspaces: store.listWorkspaces() }));

  app.post("/watches", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.competitor !== "string" || typeof body.url !== "string") {
      return c.json({ error: "competitor and url are required" }, 400);
    }
    const label: WatchLabel = WATCH_LABELS.includes(body.label) ? body.label : "other";
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : store.ensureWorkspace("local").id;
    const watch = store.addWatch({
      competitor: body.competitor,
      url: body.url,
      label,
      workspaceId,
    });
    return c.json({ watch }, 201);
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

  // Enqueue-and-run an immediate crawl for a watch (mirrors the CF Queue
  // consumer in production). Scrapes, snapshots, and diffs against the
  // previous snapshot to emit a materiality-classified change event.
  app.post("/watches/:id/crawl", async (c) => {
    const watch = store.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);

    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const fixture = typeof body.fixture === "string" ? body.fixture : undefined;

    const result = await scrape(watch.url, { apiKey: c.env.FIRECRAWL_API_KEY, fixture });
    const previous = store.latestSnapshot(watch.id);

    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      watchId: watch.id,
      contentHash: contentHash(result.extracted),
      extracted: result.extracted,
      createdAt: new Date().toISOString(),
    };
    store.addSnapshot(snapshot);

    const event = diffPricing(previous?.extracted ?? null, result.extracted, watch.url);
    const change: StoredChange = {
      ...event,
      id: crypto.randomUUID(),
      watchId: watch.id,
      createdAt: new Date().toISOString(),
    };
    store.addChange(change);

    return c.json({ provider: result.provider, snapshot, change });
  });

  app.get("/watches/:id/changes", (c) => {
    const watch = store.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "watch not found" }, 404);
    return c.json({ changes: store.listChanges(watch.id) });
  });

  // Stateless diff helper: classify the materiality between two supplied
  // pricing snapshots without persisting anything.
  app.post("/diff", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.to !== "object" || body.to === null) {
      return c.json({ error: "'to' pricing snapshot is required" }, 400);
    }
    const url = typeof body.url === "string" ? body.url : "about:blank";
    const event = diffPricing(body.from ?? null, body.to, url);
    return c.json({ change: event });
  });

  // --- Battlecards (E1-5 HITL) ---

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

  // --- Digests (E1-4) ---

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
    const text = await runCompeteCommand(client, command, workspace.id);
    return slackTextResponse(text);
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
          ? `Approved battlecard \`${next.id}\` — ready to pin.`
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

  return app;
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
  async crawl(): Promise<StoredChange> {
    throw new Error("crawl not available via slash command");
  }
  async getChanges(): Promise<StoredChange[]> {
    return [];
  }
}
