import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app.js";
import {
  applyDodoWebhookEvent,
  buildMockSubscriptionWebhook,
  createCheckoutSession,
  dodoConfigFromEnv,
  signDodoWebhook,
  verifyDodoWebhook,
} from "../src/billing/dodo.js";
import { store } from "../src/store.js";

const env: Env = {};
const app = createApp();

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("E4-1 Dodo Payments", () => {
  beforeEach(() => {
    store.reset();
  });

  it("creates a mock checkout session when API key is unset", async () => {
    const ws = store.ensureWorkspace("T_BILL", "trial");
    const res = await post("/billing/checkout", { workspaceId: ws.id, plan: "pro" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      mock: boolean;
      checkoutUrl: string;
      plan: string;
    };
    expect(body.mock).toBe(true);
    expect(body.plan).toBe("pro");
    expect(body.checkoutUrl).toContain("/billing/mock-complete");
    expect(body.checkoutUrl).toContain(ws.id);
  });

  it("mock-complete activates Pro and raises caps", async () => {
    const ws = store.ensureWorkspace("T_MOCK", "trial");
    const checkout = await post("/billing/checkout", {
      workspaceId: ws.id,
      plan: "pro",
      email: "founder@example.com",
    });
    const { checkoutUrl } = (await checkout.json()) as { checkoutUrl: string };
    const path = checkoutUrl.replace(/^https?:\/\/[^/]+/, "");
    const done = await app.request(path, {}, env);
    expect(done.status).toBe(200);

    const status = await app.request(`/billing/status/${ws.id}`, {}, env);
    const body = (await status.json()) as {
      plan: string;
      subscriptionStatus: string;
      limits: { urlLimit: number };
    };
    expect(body.plan).toBe("pro");
    expect(body.subscriptionStatus).toBe("active");
    expect(body.limits.urlLimit).toBe(100);

    // Cap should now allow more than 25 URLs.
    for (let i = 0; i < 26; i += 1) {
      store.addWatch({
        workspaceId: ws.id,
        competitor: `C${Math.floor(i / 5)}`,
        url: `https://example.com/${i}`,
        label: "pricing",
      });
    }
    expect(store.listWatches(ws.id)).toHaveLength(26);
  });

  it("webhook subscription.active upgrades plan with verified signature", async () => {
    const webhookKey = "whsec_" + btoa("test-secret-key-bytes!!");
    const testEnv: Env = {
      DODO_PAYMENTS_WEBHOOK_KEY: webhookKey,
      DODO_PRODUCT_STARTER: "pdt_starter",
      DODO_PRODUCT_PRO: "pdt_pro",
    };
    const ws = store.ensureWorkspace("T_WH", "trial");
    const event = buildMockSubscriptionWebhook({
      workspaceId: ws.id,
      plan: "starter",
      email: "pilot@example.com",
    });
    event.data.product_id = "pdt_starter";
    const raw = JSON.stringify(event);
    const signed = await signDodoWebhook(raw, webhookKey);

    const res = await app.request(
      "/billing/webhooks/dodo",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "webhook-id": signed.id,
          "webhook-timestamp": signed.timestamp,
          "webhook-signature": signed.signature,
        },
        body: raw,
      },
      testEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { handled: boolean; plan: string };
    expect(body.handled).toBe(true);
    expect(body.plan).toBe("starter");
    expect(store.getWorkspace(ws.id)?.plan).toBe("starter");
    expect(store.getWorkspace(ws.id)?.subscriptionStatus).toBe("active");
  });

  it("rejects invalid webhook signatures when secret is set", async () => {
    const testEnv: Env = { DODO_PAYMENTS_WEBHOOK_KEY: "whsec_" + btoa("real-secret") };
    const res = await app.request(
      "/billing/webhooks/dodo",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "webhook-id": "msg_1",
          "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
          "webhook-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        },
        body: JSON.stringify({ type: "subscription.active", data: {} }),
      },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("idempotently ignores duplicate webhook-id", async () => {
    const ws = store.ensureWorkspace("T_IDEM", "trial");
    const event = buildMockSubscriptionWebhook({ workspaceId: ws.id, plan: "pro" });
    const raw = JSON.stringify(event);
    const headers = {
      "Content-Type": "application/json",
      "webhook-id": "msg_dup_1",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,unused",
    };
    const first = await app.request(
      "/billing/webhooks/dodo",
      { method: "POST", headers, body: raw },
      env,
    );
    expect(first.status).toBe(200);
    const second = await app.request(
      "/billing/webhooks/dodo",
      { method: "POST", headers, body: raw },
      env,
    );
    const body = (await second.json()) as { duplicate: boolean };
    expect(body.duplicate).toBe(true);
  });

  it("subscription.cancelled drops workspace to trial", async () => {
    const ws = store.ensureWorkspace("T_CANCEL", "pro");
    store.updateWorkspace(ws.id, {
      dodoSubscriptionId: "sub_cancel_1",
      subscriptionStatus: "active",
    });
    const event = buildMockSubscriptionWebhook({
      workspaceId: ws.id,
      plan: "pro",
      subscriptionId: "sub_cancel_1",
      type: "subscription.cancelled",
    });
    const res = await post("/billing/webhooks/dodo", event, {
      "webhook-id": "msg_cancel_1",
    });
    expect(res.status).toBe(200);
    const updated = store.getWorkspace(ws.id)!;
    expect(updated.plan).toBe("trial");
    expect(updated.subscriptionStatus).toBe("cancelled");
  });

  it("maps product_id to plan when metadata.plan is absent", () => {
    const config = dodoConfigFromEnv({
      DODO_PRODUCT_STARTER: "pdt_s",
      DODO_PRODUCT_PRO: "pdt_p",
    });
    const applied = applyDodoWebhookEvent(config, {
      type: "subscription.active",
      data: {
        payload_type: "Subscription",
        subscription_id: "sub_1",
        product_id: "pdt_p",
        metadata: { workspace_id: "ws_1" },
      },
    });
    expect(applied.plan).toBe("pro");
    expect(applied.handled).toBe(true);
  });

  it("verifyDodoWebhook accepts a correctly signed body", async () => {
    const key = "whsec_" + btoa("abc123secret!!!!!");
    const body = '{"type":"subscription.active","data":{}}';
    const signed = await signDodoWebhook(body, key);
    const ok = await verifyDodoWebhook(
      body,
      { id: signed.id, timestamp: signed.timestamp, signature: signed.signature },
      key,
    );
    expect(ok).toEqual({ ok: true });
  });

  it("createCheckoutSession requires product ids when live API key is set", async () => {
    await expect(
      createCheckoutSession(
        { apiKey: "sk_test", environment: "test_mode" },
        { workspaceId: "ws", plan: "starter" },
      ),
    ).rejects.toThrow(/DODO_PRODUCT_STARTER/);
  });
});
