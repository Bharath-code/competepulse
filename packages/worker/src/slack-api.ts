/**
 * Slack Web API helpers (Path B2) — outbound digests and battlecards.
 */

export interface SlackPostResult {
  ok: boolean;
  ts?: string;
  error?: string;
}

export async function slackPostMessage(opts: {
  token: string;
  channel: string;
  text: string;
  blocks?: unknown[];
  fetchImpl?: typeof fetch;
}): Promise<SlackPostResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: opts.channel,
      text: opts.text,
      blocks: opts.blocks,
    }),
  });
  const json = (await res.json()) as { ok?: boolean; ts?: string; error?: string };
  if (!json.ok) {
    return { ok: false, error: json.error ?? `http_${res.status}` };
  }
  return { ok: true, ts: json.ts };
}

export async function exchangeSlackOAuthCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  ok: boolean;
  teamId?: string;
  botToken?: string;
  error?: string;
}> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
  });
  const res = await fetchImpl("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    access_token?: string;
    team?: { id?: string };
  };
  if (!json.ok || !json.access_token || !json.team?.id) {
    return { ok: false, error: json.error ?? "oauth_failed" };
  }
  return { ok: true, teamId: json.team.id, botToken: json.access_token };
}
