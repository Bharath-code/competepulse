import type { Hono } from "hono";
import { type PlanId } from "@competepulse/core";
import { generateWorkspaceToken, hashToken, secretMissing } from "../access.js";
import { getStore } from "../get-store.js";
import { snapshotPublicPath } from "../r2.js";
import { publicWorkspace } from "../secrets.js";
import { type WorkspacePatch } from "../store.js";
import { type Env, PLAN_IDS, requireAccess, isAdmin, outOfScope, sealBotToken } from "../shared.js";

export function registerWorkspaces(app: Hono<{ Bindings: Env }>) {
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
}
