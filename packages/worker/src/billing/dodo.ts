/**
 * Dodo Payments integration (E4-1).
 *
 * Uses Checkout Sessions + Standard Webhooks. When DODO_PAYMENTS_API_KEY is
 * unset, checkout returns a local mock URL so hermetic tests / local demos
 * still exercise plan activation.
 *
 * Dashboard setup:
 * 1. Create Starter ($149/mo) and Pro ($399/mo) subscription products.
 * 2. Put product ids in DODO_PRODUCT_STARTER / DODO_PRODUCT_PRO.
 * 3. Point a webhook endpoint at POST /billing/webhooks/dodo and subscribe to
 *    subscription.active|renewed|plan_changed|on_hold|paused|cancelled|expired|failed.
 */

import { isPaidPlan, type PaidPlanId, type PlanId } from "@competepulse/core";

export type DodoEnvironment = "test_mode" | "live_mode";

export interface DodoConfig {
  apiKey?: string;
  webhookKey?: string;
  environment: DodoEnvironment;
  productStarter?: string;
  productPro?: string;
  returnUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  mock: boolean;
  plan: PaidPlanId;
  workspaceId: string;
}

export type SubscriptionStatus =
  "none" | "active" | "on_hold" | "paused" | "cancelled" | "expired" | "failed";

export interface DodoWebhookEvent {
  business_id?: string;
  type: string;
  timestamp?: string;
  data: {
    payload_type?: string;
    subscription_id?: string;
    product_id?: string;
    status?: string;
    customer?: { customer_id?: string; email?: string; name?: string };
    metadata?: Record<string, string>;
    [key: string]: unknown;
  };
}

export interface BillingApplyResult {
  workspaceId: string | null;
  plan: PlanId | null;
  subscriptionId: string | null;
  status: SubscriptionStatus;
  customerId: string | null;
  email: string | null;
  handled: boolean;
}

const API_BASE: Record<DodoEnvironment, string> = {
  test_mode: "https://test.dodopayments.com",
  live_mode: "https://live.dodopayments.com",
};

export function dodoConfigFromEnv(env: {
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PAYMENTS_ENVIRONMENT?: string;
  DODO_PRODUCT_STARTER?: string;
  DODO_PRODUCT_PRO?: string;
  DODO_PAYMENTS_RETURN_URL?: string;
}): DodoConfig {
  const environment: DodoEnvironment =
    env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
  return {
    apiKey: env.DODO_PAYMENTS_API_KEY || undefined,
    webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY || undefined,
    environment,
    productStarter: env.DODO_PRODUCT_STARTER || undefined,
    productPro: env.DODO_PRODUCT_PRO || undefined,
    returnUrl: env.DODO_PAYMENTS_RETURN_URL || undefined,
  };
}

export function productIdForPlan(config: DodoConfig, plan: PaidPlanId): string | undefined {
  return plan === "pro" ? config.productPro : config.productStarter;
}

export function planFromProductId(
  config: DodoConfig,
  productId: string | undefined,
): PaidPlanId | null {
  if (!productId) return null;
  if (config.productPro && productId === config.productPro) return "pro";
  if (config.productStarter && productId === config.productStarter) return "starter";
  return null;
}

export async function createCheckoutSession(
  config: DodoConfig,
  input: {
    workspaceId: string;
    plan: PaidPlanId;
    email?: string;
    name?: string;
    origin?: string;
  },
): Promise<CheckoutSessionResult> {
  const returnUrl =
    config.returnUrl ??
    (input.origin
      ? `${input.origin}/dashboard?billing=success`
      : "http://localhost:8787/dashboard?billing=success");

  const metadata = {
    workspace_id: input.workspaceId,
    plan: input.plan,
  };

  if (!config.apiKey) {
    const sessionId = `mock_cs_${crypto.randomUUID()}`;
    const params = new URLSearchParams({
      session_id: sessionId,
      workspace_id: input.workspaceId,
      plan: input.plan,
    });
    if (input.email) params.set("email", input.email);
    const base = input.origin ?? "http://localhost:8787";
    return {
      sessionId,
      checkoutUrl: `${base}/billing/mock-complete?${params.toString()}`,
      mock: true,
      plan: input.plan,
      workspaceId: input.workspaceId,
    };
  }

  const productId = productIdForPlan(config, input.plan);
  if (!productId) {
    throw new Error(
      `Missing DODO_PRODUCT_${input.plan.toUpperCase()} — create the product in Dodo and set the env var.`,
    );
  }

  const body: Record<string, unknown> = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: returnUrl,
    metadata,
  };
  if (input.email || input.name) {
    body.customer = {
      ...(input.email ? { email: input.email } : {}),
      ...(input.name ? { name: input.name } : {}),
    };
  }

  const res = await fetch(`${API_BASE[config.environment]}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dodo checkout failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    session_id?: string;
    checkout_url?: string;
  };
  if (!json.checkout_url || !json.session_id) {
    throw new Error("Dodo checkout response missing session_id/checkout_url");
  }

  return {
    sessionId: json.session_id,
    checkoutUrl: json.checkout_url,
    mock: false,
    plan: input.plan,
    workspaceId: input.workspaceId,
  };
}

/** Map Dodo subscription lifecycle events onto our workspace billing state. */
export function applyDodoWebhookEvent(
  config: DodoConfig,
  event: DodoWebhookEvent,
): BillingApplyResult {
  const data = event.data ?? { payload_type: undefined };
  const metadata = data.metadata ?? {};
  const subscriptionId = typeof data.subscription_id === "string" ? data.subscription_id : null;
  const customerId =
    typeof data.customer?.customer_id === "string" ? data.customer.customer_id : null;
  const email = typeof data.customer?.email === "string" ? data.customer.email : null;

  const workspaceId = typeof metadata.workspace_id === "string" ? metadata.workspace_id : null;
  let plan: PlanId | null =
    typeof metadata.plan === "string" && isPaidPlan(metadata.plan) ? metadata.plan : null;

  if (!plan) {
    plan = planFromProductId(
      config,
      typeof data.product_id === "string" ? data.product_id : undefined,
    );
  }

  const type = event.type;

  if (
    type === "subscription.active" ||
    type === "subscription.renewed" ||
    type === "subscription.plan_changed"
  ) {
    return {
      workspaceId,
      plan: plan ?? "starter",
      subscriptionId,
      status: "active",
      customerId,
      email,
      handled: true,
    };
  }

  if (type === "subscription.on_hold") {
    return {
      workspaceId,
      plan,
      subscriptionId,
      status: "on_hold",
      customerId,
      email,
      handled: true,
    };
  }

  if (type === "subscription.paused") {
    return {
      workspaceId,
      plan,
      subscriptionId,
      status: "paused",
      customerId,
      email,
      handled: true,
    };
  }

  if (type === "subscription.cancelled" || type === "subscription.expired") {
    return {
      workspaceId,
      plan: "trial",
      subscriptionId,
      status: type === "subscription.cancelled" ? "cancelled" : "expired",
      customerId,
      email,
      handled: true,
    };
  }

  if (type === "subscription.failed") {
    return {
      workspaceId,
      plan,
      subscriptionId,
      status: "failed",
      customerId,
      email,
      handled: true,
    };
  }

  return {
    workspaceId,
    plan,
    subscriptionId,
    status: "none",
    customerId,
    email,
    handled: false,
  };
}

export function buildMockSubscriptionWebhook(input: {
  workspaceId: string;
  plan: PaidPlanId;
  email?: string;
  subscriptionId?: string;
  type?: string;
}): DodoWebhookEvent {
  return {
    business_id: "biz_local",
    type: input.type ?? "subscription.active",
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Subscription",
      subscription_id: input.subscriptionId ?? `sub_mock_${crypto.randomUUID()}`,
      product_id: `pdt_mock_${input.plan}`,
      status: "active",
      customer: {
        customer_id: `cus_mock_${input.workspaceId.slice(0, 8)}`,
        email: input.email ?? "pilot@example.com",
      },
      metadata: {
        workspace_id: input.workspaceId,
        plan: input.plan,
      },
    },
  };
}

/**
 * Verify a Standard Webhooks signature (Dodo's format).
 * Skips verification when webhookKey is unset (local/dev parity with Slack).
 */
export async function verifyDodoWebhook(
  rawBody: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
  webhookKey: string | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!webhookKey) return { ok: true };

  const id = headers.id;
  const timestamp = headers.timestamp;
  const signatureHeader = headers.signature;
  if (!id || !timestamp || !signatureHeader) {
    return { ok: false, error: "missing webhook signature headers" };
  }

  // Reject stale timestamps (>5 minutes) when verifying.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return { ok: false, error: "webhook timestamp out of range" };
  }

  const keyBytes = decodeWebhookSecret(webhookKey);
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedContent),
  );
  const expected = bytesToBase64(new Uint8Array(digest));

  const candidates = signatureHeader.split(/\s+/).flatMap((part) => {
    const [, value] = part.split(",", 2);
    return value ? [value] : [];
  });

  if (!candidates.some((c) => timingSafeEqual(c, expected))) {
    return { ok: false, error: "invalid webhook signature" };
  }
  return { ok: true };
}

/** Sign a payload for tests (mirrors Standard Webhooks). */
export async function signDodoWebhook(
  rawBody: string,
  webhookKey: string,
  opts?: { id?: string; timestamp?: string },
): Promise<{ id: string; timestamp: string; signature: string }> {
  const id = opts?.id ?? `msg_${crypto.randomUUID()}`;
  const timestamp = opts?.timestamp ?? String(Math.floor(Date.now() / 1000));
  const keyBytes = decodeWebhookSecret(webhookKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  return {
    id,
    timestamp,
    signature: `v1,${bytesToBase64(new Uint8Array(digest))}`,
  };
}

function decodeWebhookSecret(secret: string): Uint8Array {
  if (secret.startsWith("whsec_")) {
    const b64 = secret.slice("whsec_".length);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(secret);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
