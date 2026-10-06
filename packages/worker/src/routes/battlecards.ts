import type { Hono } from "hono";
import {
  approveBattlecard,
  battlecardActionBlocks,
  draftBattlecard,
  publishBattlecard,
  rejectBattlecard,
  type BattlecardDraft as AgentBattlecard,
} from "@competepulse/agent";
import { deliverAllWorkspaceDigests, deliverWorkspaceDigest } from "../digest-deliver.js";
import { runAllWorkspaceDigests, runWorkspaceDigest } from "../digest.js";
import { getStore } from "../get-store.js";
import { slackPostMessage } from "../slack-api.js";
import { workspaceBotToken } from "../secrets.js";
import { type Env, requireAccess, isAdmin, scopedWorkspaceId, outOfScope } from "../shared.js";

export function registerBattlecards(app: Hono<{ Bindings: Env }>) {
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
}
