import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app.js";
import { store } from "../src/store.js";

const env: Env = { ENVIRONMENT: "production", DASHBOARD_ACCESS_TOKEN: "admin-secret" };
const app = createApp();

function call(path: string, token: string, init: RequestInit = {}) {
  return app.request(
    path,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        ...init.headers,
      },
    },
    env,
  );
}

async function provision(team: string) {
  const { workspace } = (await (
    await call("/workspaces", "admin-secret", {
      method: "POST",
      body: JSON.stringify({ slackTeamId: team }),
    })
  ).json()) as { workspace: { id: string } };
  const { token } = (await (
    await call(`/workspaces/${workspace.id}/token`, "admin-secret", { method: "POST" })
  ).json()) as { token: string };
  const { watch } = (await (
    await call("/watches", token, {
      method: "POST",
      body: JSON.stringify({ competitor: team, url: `https://${team}.example.com/pricing` }),
    })
  ).json()) as { watch: { id: string } };
  return { id: workspace.id, token, watchId: watch.id };
}

describe("per-workspace tokens", () => {
  beforeEach(() => store.reset());

  it("a workspace token reads and writes only its own workspace", async () => {
    const a = await provision("A");
    const b = await provision("B");

    const own = await call("/watches", a.token);
    expect(((await own.json()) as { watches: unknown[] }).watches).toHaveLength(1);

    const spoof = await call(`/watches?workspaceId=${b.id}`, a.token);
    expect(spoof.status).toBe(404);

    for (const path of [
      `/watches/${b.watchId}/changes`,
      `/watches/${b.watchId}/snapshots`,
      `/workspaces/${b.id}/usage`,
      `/billing/status/${b.id}`,
    ]) {
      expect((await call(path, a.token)).status, path).toBe(404);
    }

    const del = await call(`/watches/${b.watchId}`, a.token, { method: "DELETE" });
    expect(del.status).toBe(404);
    expect((await call(`/watches/${b.watchId}/changes`, b.token)).status).toBe(200);
  });

  it("a workspace token cannot reach admin routes or raise its own plan", async () => {
    const a = await provision("A");
    expect((await call("/workspaces", a.token)).status).toBe(403);
    expect((await call("/queues/crawl/fanout", a.token, { method: "POST" })).status).toBe(403);
    expect((await call(`/workspaces/${a.id}/token`, a.token, { method: "POST" })).status).toBe(403);

    const res = await call(`/workspaces/${a.id}`, a.token, {
      method: "PATCH",
      body: JSON.stringify({ plan: "pro", quietMode: "skip" }),
    });
    const { workspace } = (await res.json()) as { workspace: { plan: string; quietMode: string } };
    expect(workspace.quietMode).toBe("skip");
    expect(workspace.plan).not.toBe("pro");
  });

  it("rotating a token revokes the old one; garbage tokens get 401", async () => {
    const a = await provision("A");
    const { token } = (await (
      await call(`/workspaces/${a.id}/token`, "admin-secret", { method: "POST" })
    ).json()) as { token: string };
    expect((await call("/watches", a.token)).status).toBe(401);
    expect((await call("/watches", token)).status).toBe(200);
    expect((await call("/watches", "nope")).status).toBe(401);
  });
});
