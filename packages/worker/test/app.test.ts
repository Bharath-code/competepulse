import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app.js";
import { store } from "../src/store.js";

const env: Env = {};
const app = createApp();

function post(path: string, body: unknown) {
  return app.request(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    env,
  );
}

describe("worker API", () => {
  beforeEach(() => store.reset());

  it("reports health", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("creates, lists and removes watches", async () => {
    const created = await post("/watches", {
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    expect(created.status).toBe(201);
    const { watch } = (await created.json()) as { watch: { id: string } };

    const list = await app.request("/watches", {}, env);
    expect((await list.json()) as { watches: unknown[] }).toMatchObject({
      watches: [{ id: watch.id }],
    });

    const removed = await app.request(`/watches/${watch.id}`, { method: "DELETE" }, env);
    expect(removed.status).toBe(200);
  });

  it("rejects invalid watch payloads", async () => {
    const res = await post("/watches", { competitor: "Acme" });
    expect(res.status).toBe(400);
  });

  it("runs a crawl end-to-end and detects a material price change", async () => {
    const created = await post("/watches", {
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });
    const { watch } = (await created.json()) as { watch: { id: string } };

    const first = await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v1" });
    expect(((await first.json()) as { change: { materiality: string } }).change.materiality).toBe(
      "none",
    );

    const second = await post(`/watches/${watch.id}/crawl`, { fixture: "acme_v2" });
    const secondBody = (await second.json()) as {
      provider: string;
      change: { materiality: string; findings: unknown[]; citations: string[] };
    };
    expect(secondBody.provider).toBe("mock");
    expect(secondBody.change.materiality).toBe("high");
    expect(secondBody.change.citations).toContain("https://acme.example/pricing");

    const changes = await app.request(`/watches/${watch.id}/changes`, {}, env);
    expect(((await changes.json()) as { changes: unknown[] }).changes).toHaveLength(2);
  });

  it("classifies a supplied diff via /diff", async () => {
    const res = await post("/diff", {
      url: "https://acme.example/pricing",
      from: {
        currency: "USD",
        plans: [{ name: "Pro", price_monthly: 99, price_annual: 79, unit: "seat" }],
        features_called_out: [],
        free_trial_days: 14,
        notes: [],
      },
      to: {
        currency: "USD",
        plans: [{ name: "Pro", price_monthly: 129, price_annual: 79, unit: "seat" }],
        features_called_out: [],
        free_trial_days: 14,
        notes: [],
      },
    });
    expect(((await res.json()) as { change: { materiality: string } }).change.materiality).toBe(
      "high",
    );
  });
});
