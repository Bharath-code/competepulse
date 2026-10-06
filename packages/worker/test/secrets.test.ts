import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app.js";
import { decryptSecret, encryptSecret } from "../src/secrets.js";
import { store } from "../src/store.js";

const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const env: Env = { ENVIRONMENT: "local", TOKEN_ENCRYPTION_KEY: key };
const app = createApp();

describe("bot token protection", () => {
  beforeEach(() => store.reset());

  it("round-trips, uses a fresh IV, and passes legacy plaintext through", async () => {
    const a = await encryptSecret("xoxb-secret", key);
    const b = await encryptSecret("xoxb-secret", key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("xoxb");
    expect(await decryptSecret(a, key)).toBe("xoxb-secret");
    expect(await decryptSecret("xoxb-legacy", undefined)).toBe("xoxb-legacy");
  });

  it("rejects a tampered ciphertext and a wrong key", async () => {
    const enc = await encryptSecret("xoxb-secret", key);
    const other = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
    await expect(decryptSecret(enc, other)).rejects.toThrow();
    await expect(decryptSecret(enc.slice(0, -4) + "AAAA", key)).rejects.toThrow();
  });

  it("stores the token encrypted and never returns it over HTTP", async () => {
    const { workspace } = (await (
      await app.request(
        "/workspaces",
        { method: "POST", body: JSON.stringify({ slackTeamId: "T1" }) },
        env,
      )
    ).json()) as { workspace: { id: string } };
    const patched = await app.request(
      `/workspaces/${workspace.id}`,
      { method: "PATCH", body: JSON.stringify({ slackBotToken: "xoxb-123-abc" }) },
      env,
    );
    expect(await patched.text()).not.toMatch(/xox[bp]-/);

    const list = await (await app.request("/workspaces", {}, env)).text();
    expect(list).not.toMatch(/xox[bp]-/);
    expect(list).toContain('"slackConnected":true');

    const stored = (await store.getWorkspace(workspace.id))?.slackBotToken;
    expect(stored?.startsWith("enc1:")).toBe(true);
  });

  it("refuses to store a bot token in prod without a key", async () => {
    const prod: Env = { ENVIRONMENT: "production", DASHBOARD_ACCESS_TOKEN: "a" };
    const ws = await store.ensureWorkspace("T2");
    const res = await app.request(
      `/workspaces/${ws.id}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer a" },
        body: JSON.stringify({ slackBotToken: "xoxb-1" }),
      },
      prod,
    );
    expect(res.status).toBe(503);
  });
});
