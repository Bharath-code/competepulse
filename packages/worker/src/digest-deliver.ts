import type { DigestRunResult } from "./digest.js";
import { runAllWorkspaceDigests, runWorkspaceDigest } from "./digest.js";
import { slackPostMessage } from "./slack-api.js";
import type { Store, Workspace } from "./store.js";

export interface DigestDeliverEnv {
  SLACK_BOT_TOKEN?: string;
  FOUNDER_ALERT_WEBHOOK?: string;
}

/**
 * Run digest then post to Slack when channel + token are available (B2).
 * Does **not** mark delivery until format succeeds; Slack failures leave
 * delivery saved (idempotent) but surface slackError for alerts/retry policy.
 *
 * Note: delivery row is written before Slack post (current digest.ts). On Slack
 * failure we alert founder and return slackPosted=false so ops can re-post.
 */
export async function deliverWorkspaceDigest(
  data: Store,
  workspaceId: string,
  env: DigestDeliverEnv,
  now: Date = new Date(),
): Promise<DigestRunResult> {
  const result = await runWorkspaceDigest(data, workspaceId, now);
  if (!result.delivered || result.skipped) return result;

  const workspace = await data.getWorkspace(workspaceId);
  return postDigestToSlack(result, workspace, env);
}

export async function deliverAllWorkspaceDigests(
  data: Store,
  env: DigestDeliverEnv,
  now: Date = new Date(),
): Promise<DigestRunResult[]> {
  const results = await runAllWorkspaceDigests(data, now);
  const workspaces = await data.listWorkspaces();
  const byId = new Map(workspaces.map((w) => [w.id, w]));
  const out: DigestRunResult[] = [];
  for (const result of results) {
    const ws = result.delivery
      ? byId.get(result.delivery.workspaceId)
      : undefined;
    if (result.delivered && !result.skipped) {
      out.push(await postDigestToSlack(result, ws, env));
    } else {
      out.push(result);
    }
  }
  return out;
}

async function postDigestToSlack(
  result: DigestRunResult,
  workspace: Workspace | undefined,
  env: DigestDeliverEnv,
): Promise<DigestRunResult> {
  const channel = workspace?.digestChannelId;
  const token = workspace?.slackBotToken || env.SLACK_BOT_TOKEN;
  if (!channel) {
    return { ...result, slackPosted: false, slackError: "no_digest_channel" };
  }
  if (!token) {
    console.error("[digest] SLACK_BOT_TOKEN missing; cannot post", workspace?.id);
    await alertFounder(env, `Digest ready but no Slack token for workspace ${workspace?.id}`);
    return { ...result, slackPosted: false, slackError: "missing_slack_token" };
  }

  const posted = await slackPostMessage({
    token,
    channel,
    text: result.body,
    blocks: result.blocks,
  });
  if (!posted.ok) {
    console.error("[digest] Slack post failed", posted.error, workspace?.id);
    await alertFounder(
      env,
      `Digest Slack post failed for ${workspace?.id}: ${posted.error}`,
    );
    return { ...result, slackPosted: false, slackError: posted.error };
  }
  return { ...result, slackPosted: true };
}

export async function alertFounder(
  env: DigestDeliverEnv,
  message: string,
): Promise<void> {
  if (!env.FOUNDER_ALERT_WEBHOOK) {
    console.error("[alert]", message);
    return;
  }
  try {
    await fetch(env.FOUNDER_ALERT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    console.error("[alert] webhook failed", err);
  }
}
