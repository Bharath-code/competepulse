/**
 * Slack slash-command + interactivity helpers (E1-2 / E1-3 / E1-5).
 * Signature verification is enforced when `SLACK_SIGNING_SECRET` is set;
 * local/tests skip verification when the secret is absent.
 */

const encoder = new TextEncoder();

export async function verifySlackSignature(
  signingSecret: string | undefined,
  request: Request,
  rawBody: string,
): Promise<boolean> {
  if (!signingSecret) return true;

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!timestamp || !signature) return false;

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(base));
  const digest = `v0=${bufferToHex(mac)}`;
  return timingSafeEqual(digest, signature);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export interface SlackCommandPayload {
  team_id: string;
  channel_id: string;
  user_id: string;
  command: string;
  text: string;
  response_url?: string;
}

export function parseSlashForm(body: string): SlackCommandPayload {
  const params = new URLSearchParams(body);
  return {
    team_id: params.get("team_id") ?? "",
    channel_id: params.get("channel_id") ?? "",
    user_id: params.get("user_id") ?? "",
    command: params.get("command") ?? "",
    text: params.get("text") ?? "",
    response_url: params.get("response_url") ?? undefined,
  };
}

export interface SlackInteractionPayload {
  type: string;
  user: { id: string };
  team: { id: string };
  actions?: Array<{ action_id: string; value: string }>;
}

export function parseInteractionPayload(body: string): SlackInteractionPayload {
  const params = new URLSearchParams(body);
  const raw = params.get("payload");
  if (!raw) throw new Error("missing payload");
  return JSON.parse(raw) as SlackInteractionPayload;
}

/** Ephemeral Slack response helper. */
export function slackTextResponse(text: string, ephemeral = true): Response {
  return Response.json({
    response_type: ephemeral ? "ephemeral" : "in_channel",
    text,
  });
}
