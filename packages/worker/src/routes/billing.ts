import type { Hono } from "hono";
import { isPaidPlan, planLimits, type PaidPlanId, type PlanId } from "@competepulse/core";
import { isLocal, secretMissing } from "../access.js";
import {
  buildMockSubscriptionWebhook,
  createCheckoutSession,
  dodoConfigFromEnv,
  verifyDodoWebhook,
  type DodoWebhookEvent,
} from "../billing/dodo.js";
import { getStore } from "../get-store.js";
import { publicWorkspace } from "../secrets.js";
import { type Env, requireAccess, outOfScope, applyBillingEvent } from "../shared.js";

export function registerBilling(app: Hono<{ Bindings: Env }>) {
  app.get("/meta/plans", (c) =>
    c.json({
      plans: ["trial", "starter", "pro"].map((p) => planLimits(p as PlanId)),
      billingProvider: "dodopayments",
    }),
  );

  app.post("/billing/checkout", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const data = getStore(c.env);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.workspaceId !== "string") {
      return c.json({ error: "workspaceId is required" }, 400);
    }
    const scoped = outOfScope(c, body.workspaceId);
    if (scoped) return scoped;
    if (typeof body.plan !== "string" || !isPaidPlan(body.plan)) {
      return c.json({ error: "plan must be 'starter' or 'pro'" }, 400);
    }
    const workspace = await data.getWorkspace(body.workspaceId);
    if (!workspace) return c.json({ error: "workspace not found" }, 404);

    const plan = body.plan as PaidPlanId;
    const config = dodoConfigFromEnv(c.env);
    if (!config.apiKey && !isLocal(c.env)) {
      return c.json({ error: "billing not configured" }, 503);
    }
    const origin = new URL(c.req.url).origin;

    try {
      const session = await createCheckoutSession(config, {
        workspaceId: workspace.id,
        plan,
        email: typeof body.email === "string" ? body.email : (workspace.billingEmail ?? undefined),
        name: typeof body.name === "string" ? body.name : undefined,
        origin,
      });
      return c.json({
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        mock: session.mock,
        plan: session.plan,
        workspaceId: session.workspaceId,
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
  });

  app.get("/billing/mock-complete", async (c) => {
    if (!isLocal(c.env)) return c.json({ error: "not found" }, 404);
    const data = getStore(c.env);
    const workspaceId = c.req.query("workspace_id");
    const planRaw = c.req.query("plan");
    if (!workspaceId || !planRaw || !isPaidPlan(planRaw)) {
      return c.json({ error: "workspace_id and plan=starter|pro are required" }, 400);
    }
    const workspace = await data.getWorkspace(workspaceId);
    if (!workspace) return c.json({ error: "workspace not found" }, 404);

    const event = buildMockSubscriptionWebhook({
      workspaceId,
      plan: planRaw,
      email: c.req.query("email") ?? undefined,
    });
    const applied = await applyBillingEvent(data, dodoConfigFromEnv(c.env), event);
    if (c.req.header("accept")?.includes("text/html")) {
      return c.html(
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h1>CompetePulse</h1>
          <p>Mock checkout complete — workspace now on <strong>${applied.plan}</strong>.</p>
          <p><a href="/dashboard">Back to dashboard</a></p>
        </body></html>`,
      );
    }
    return c.json({
      ok: true,
      workspace: publicWorkspace(await data.getWorkspace(workspaceId)),
      event: applied,
    });
  });

  app.post("/billing/webhooks/dodo", async (c) => {
    const rawBody = await c.req.text();
    const config = dodoConfigFromEnv(c.env);
    if (secretMissing(config.webhookKey, c.env, "DODO_PAYMENTS_WEBHOOK_KEY")) {
      return c.json({ error: "secret_missing" }, 503);
    }
    const verified = await verifyDodoWebhook(
      rawBody,
      {
        id: c.req.header("webhook-id") ?? null,
        timestamp: c.req.header("webhook-timestamp") ?? null,
        signature: c.req.header("webhook-signature") ?? null,
      },
      config.webhookKey,
    );
    if (!verified.ok) {
      return c.json({ error: verified.error }, 401);
    }

    const data = getStore(c.env);
    const webhookId = c.req.header("webhook-id");
    if (webhookId && !(await data.claimWebhook(webhookId))) {
      return c.json({ received: true, duplicate: true });
    }

    let event: DodoWebhookEvent;
    try {
      event = JSON.parse(rawBody) as DodoWebhookEvent;
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }

    const applied = await applyBillingEvent(data, config, event);
    return c.json({ received: true, ...applied });
  });

  app.get("/billing/status/:workspaceId", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    const scoped = outOfScope(c, c.req.param("workspaceId"));
    if (scoped) return scoped;
    const workspace = await getStore(c.env).getWorkspace(c.req.param("workspaceId"));
    if (!workspace) return c.json({ error: "workspace not found" }, 404);
    return c.json({
      workspaceId: workspace.id,
      plan: workspace.plan,
      limits: planLimits(workspace.plan),
      subscriptionStatus: workspace.subscriptionStatus,
      dodoCustomerId: workspace.dodoCustomerId,
      dodoSubscriptionId: workspace.dodoSubscriptionId,
      billingEmail: workspace.billingEmail,
      provider: "dodopayments",
    });
  });
}
