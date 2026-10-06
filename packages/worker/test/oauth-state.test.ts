import { describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app.js";
import { createOAuthState, verifyOAuthState } from "../src/oauth-state.js";

const app = createApp();
const env: Env = {
  ENVIRONMENT: "production",
  SLACK_CLIENT_ID: "cid",
  SLACK_CLIENT_SECRET: "csecret",
  TOKEN_ENCRYPTION_KEY: btoa("k".repeat(32)),
};

describe("slack oauth state", () => {
  it("install sets a state param and a matching HttpOnly cookie", async () => {
    const res = await app.request("/slack/install", {}, env);
    const state = new URL(res.headers.get("location")!).searchParams.get("state")!;
    const cookie = res.headers.get("set-cookie")!;
    const nonce = /cp_oauth=([^;]+)/.exec(cookie)![1];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(await verifyOAuthState("csecret", state, nonce)).toBe(true);
  });

  it.each([
    ["missing state", undefined],
    ["forged state", "a.9999999999999.deadbeef"],
  ])("callback rejects %s", async (_n, state) => {
    const q = state ? `&state=${state}` : "";
    const res = await app.request(`/slack/oauth/callback?code=c${q}`, {}, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_state" });
  });

  it("rejects expired, wrong-secret and wrong-browser states", async () => {
    const { nonce, state } = await createOAuthState("csecret", 0);
    expect(await verifyOAuthState("csecret", state, nonce, 11 * 60 * 1000)).toBe(false);
    expect(await verifyOAuthState("other", state, nonce, 1)).toBe(false);
    expect(await verifyOAuthState("csecret", state, "someone-else", 1)).toBe(false);
    expect(await verifyOAuthState("csecret", state, null, 1)).toBe(false);
  });
});
