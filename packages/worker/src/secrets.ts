import type { Workspace } from "./store.js";

const PREFIX = "enc1:";

const b64 = {
  enc: (b: Uint8Array) => btoa(String.fromCharCode(...b)),
  dec: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = b64.dec(keyB64.trim());
  if (raw.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** AES-256-GCM, fresh 96-bit IV per value. Output: `enc1:<iv>:<ciphertext>` (base64). */
export async function encryptSecret(plain: string, keyB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await importKey(keyB64),
    new TextEncoder().encode(plain),
  );
  return `${PREFIX}${b64.enc(iv)}:${b64.enc(new Uint8Array(ct))}`;
}

/** Values without the `enc1:` prefix are legacy plaintext and pass through. */
export async function decryptSecret(stored: string, keyB64: string | undefined): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored;
  if (!keyB64) throw new Error("TOKEN_ENCRYPTION_KEY missing; cannot decrypt");
  const [iv, ct] = stored.slice(PREFIX.length).split(":");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64.dec(iv) },
    await importKey(keyB64),
    b64.dec(ct),
  );
  return new TextDecoder().decode(plain);
}

/** Workspace as returned over HTTP: never carries the Slack bot token. */
export function publicWorkspace(ws: Workspace | undefined) {
  if (!ws) return ws;
  const { slackBotToken, ...rest } = ws;
  return { ...rest, slackConnected: Boolean(slackBotToken) };
}

export async function workspaceBotToken(
  ws: Workspace | undefined,
  env: { TOKEN_ENCRYPTION_KEY?: string },
): Promise<string | undefined> {
  if (!ws?.slackBotToken) return undefined;
  try {
    return await decryptSecret(ws.slackBotToken, env.TOKEN_ENCRYPTION_KEY);
  } catch (err) {
    console.error(
      "[secrets] bot token undecryptable",
      ws.id,
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}
