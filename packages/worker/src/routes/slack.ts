import type { Hono } from "hono";
import {
  approveBattlecard,
  parseCompeteCommand,
  rejectBattlecard,
  runCompeteCommand,
} from "@competepulse/agent";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createOAuthState, verifyOAuthState } from "../oauth-state.js";
import { generateWorkspaceToken, hashToken, isLocal, secretMissing } from "../access.js";
import { getStore } from "../get-store.js";
import { exchangeSlackOAuthCode } from "../slack-api.js";
import {
  parseInteractionPayload,
  parseSlashForm,
  slackTextResponse,
  verifySlackSignature,
} from "../slack.js";
import { CapError } from "../store.js";
import { type Env, sealBotToken, StoreBackedClient } from "../shared.js";

export function registerSlack(app: Hono<{ Bindings: Env }>) {
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
}
