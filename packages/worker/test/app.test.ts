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

function postForm(path: string, form: Record<string, string>) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    },
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

describe("Slack /compete → D1-backed store (E1-3)", () => {
  beforeEach(() => store.reset());

  it("round-trips watch add|list|remove via slash commands", async () => {
    const add = await postForm("/slack/commands", {
      team_id: "T_TEST",
      channel_id: "C_COMPETITIVE",
      user_id: "U_PMM",
      command: "/compete",
      text: "watch add https://acme.example/pricing pricing",
    });
    expect(add.status).toBe(200);
    const addBody = (await add.json()) as { text: string };
    expect(addBody.text).toContain("Watching *Acme*");

    const list = await postForm("/slack/commands", {
      team_id: "T_TEST",
      channel_id: "C_COMPETITIVE",
      user_id: "U_PMM",
      command: "/compete",
      text: "watch list",
    });
    const listBody = (await list.json()) as { text: string };
    expect(listBody.text).toContain("Acme");

    const watchId = store.listWatches()[0]!.id;
    const remove = await postForm("/slack/commands", {
      team_id: "T_TEST",
      channel_id: "C_COMPETITIVE",
      user_id: "U_PMM",
      command: "/compete",
      text: `watch remove ${watchId}`,
    });
    expect(((await remove.json()) as { text: string }).text).toContain("Removed");
    expect(store.listWatches()).toHaveLength(0);
  });
});

describe("weekday digest schedule (E1-4)", () => {
  beforeEach(() => store.reset());

  it("is idempotent per workspace/day", async () => {
    const ws = store.ensureWorkspace("T_DIGEST");
    store.addWatch({
      workspaceId: ws.id,
      competitor: "Acme",
      url: "https://acme.example/pricing",
      label: "pricing",
    });

    const first = await post("/digests/run", {
      workspaceId: ws.id,
      now: "2026-08-06T13:00:00Z",
    });
    const firstBody = (await first.json()) as {
      result: { delivered: boolean; skipped: boolean; body: string };
    };
    expect(firstBody.result.delivered).toBe(true);

    const second = await post("/digests/run", {
      workspaceId: ws.id,
      now: "2026-08-06T15:00:00Z",
    });
    const secondBody = (await second.json()) as {
      result: { delivered: boolean; skipped: boolean };
    };
    expect(secondBody.result.skipped).toBe(true);
    expect(secondBody.result.delivered).toBe(false);
  });
});

describe("HITL battlecard approve/reject (E1-5)", () => {
  beforeEach(() => store.reset());

  it("parks a draft and resumes on Approve", async () => {
    const ws = store.ensureWorkspace("T_HITL");
    const created = await post("/battlecards", {
      workspaceId: ws.id,
      changeId: "chg1",
      watchId: "w1",
      materiality: "high",
      summary: "Pro monthly price changed USD 99 -> USD 129.",
      citations: ["https://acme.example/pricing"],
    });
    expect(created.status).toBe(201);
    const { battlecard } = (await created.json()) as { battlecard: { id: string; status: string } };
    expect(battlecard.status).toBe("draft");

    const interaction = await postForm("/slack/interactions", {
      payload: JSON.stringify({
        type: "block_actions",
        user: { id: "U_PMM" },
        team: { id: "T_HITL" },
        actions: [{ action_id: "battlecard_approve", value: battlecard.id }],
      }),
    });
    expect(interaction.status).toBe(200);
    expect(((await interaction.json()) as { text: string }).text).toContain("Approved");
    expect(store.getBattlecard(battlecard.id)?.status).toBe("approved");
  });

  it("rejects a draft via Slack interaction", async () => {
    const ws = store.ensureWorkspace("T_HITL");
    const created = await post("/battlecards", {
      workspaceId: ws.id,
      changeId: "chg2",
      summary: "Plan renamed.",
      citations: ["https://acme.example/pricing"],
    });
    const { battlecard } = (await created.json()) as { battlecard: { id: string } };

    await postForm("/slack/interactions", {
      payload: JSON.stringify({
        type: "block_actions",
        user: { id: "U_PMM" },
        team: { id: "T_HITL" },
        actions: [{ action_id: "battlecard_reject", value: battlecard.id }],
      }),
    });
    expect(store.getBattlecard(battlecard.id)?.status).toBe("rejected");
  });
});
