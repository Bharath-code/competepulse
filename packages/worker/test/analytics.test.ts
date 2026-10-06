import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../src/analytics.js";
import { createApp, type Env } from "../src/app.js";
import { buildMockSubscriptionWebhook, signDodoWebhook } from "../src/billing/dodo.js";
import { store } from "../src/store.js";

describe("E12 analytics", () => {
  it("no-ops without a key", async () => {
    const f = vi.fn();
    await track({}, "install", "ws", {}, f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
  });

  it("posts one capture with workspace as distinct_id, and swallows failures", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}"));
    await track({ POSTHOG_API_KEY: "phc_x" }, "paid", "ws1", { plan: "pro" }, f as never);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://us.i.posthog.com/capture/");
    expect(JSON.parse(init.body as string)).toMatchObject({
      api_key: "phc_x",
      event: "paid",
      distinct_id: "ws1",
      properties: { plan: "pro" },
    });
    const boom = vi.fn().mockRejectedValue(new Error("down"));
    await expect(
      track({ POSTHOG_API_KEY: "k" }, "install", "ws", {}, boom as never),
    ).resolves.toBeUndefined();
  });
});

describe("E12 funnel wiring", () => {
  beforeEach(() => store.reset());

  it("fires paid once per (deduped) Dodo webhook", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", f);
    const env: Env = {
      ENVIRONMENT: "local",
      POSTHOG_API_KEY: "phc_x",
      DODO_PAYMENTS_WEBHOOK_KEY: "whsec_dGVzdHNlY3JldHRlc3RzZWNyZXQ=",
    };
    const ws = store.ensureWorkspace("T_AN", "trial");
    const payload = JSON.stringify(
      buildMockSubscriptionWebhook({ workspaceId: ws.id, plan: "pro" }),
    );
    const {
      id,
      timestamp: ts,
      signature: sig,
    } = await signDodoWebhook(payload, env.DODO_PAYMENTS_WEBHOOK_KEY!, { id: "wh_1" });
    const send = () =>
      createApp().request(
        "/billing/webhooks/dodo",
        {
          method: "POST",
          headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sig },
          body: payload,
        },
        env,
      );
    expect((await send()).status).toBe(200);
    await send();
    const paid = f.mock.calls.filter(
      ([, i]) => JSON.parse((i as RequestInit).body as string).event === "paid",
    );
    expect(paid).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
