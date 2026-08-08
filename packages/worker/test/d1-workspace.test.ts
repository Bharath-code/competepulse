import { beforeEach, describe, expect, it } from "vitest";
import {
  buildWorkspaceUpdateSql,
  D1WorkspaceStore,
  workspaceFromRow,
} from "../src/workspace-store.js";

describe("D1 workspace SQL helpers", () => {
  it("maps a D1 row to Workspace", () => {
    const ws = workspaceFromRow({
      id: "ws_1",
      slack_team_id: "T_ABC",
      plan: "starter",
      digest_channel_id: "C123",
      digest_cron: "0 13 * * 1-5",
      quiet_mode: "skip",
      dodo_customer_id: "cus_1",
      dodo_subscription_id: "sub_1",
      subscription_status: "active",
      billing_email: "bill@example.com",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(ws).toMatchObject({
      id: "ws_1",
      slackTeamId: "T_ABC",
      plan: "starter",
      digestChannelId: "C123",
      quietMode: "skip",
      dodoCustomerId: "cus_1",
      dodoSubscriptionId: "sub_1",
      subscriptionStatus: "active",
      billingEmail: "bill@example.com",
    });
  });

  it("buildWorkspaceUpdateSql only includes provided patch keys", () => {
    const built = buildWorkspaceUpdateSql({
      plan: "pro",
      subscriptionStatus: "active",
    });
    expect(built).toEqual({
      sql: "UPDATE workspaces SET plan = ?, subscription_status = ? WHERE id = ?",
      values: ["pro", "active"],
    });
    expect(buildWorkspaceUpdateSql({})).toBeNull();
  });
});

describe("D1WorkspaceStore (mock D1)", () => {
  type Row = Record<string, unknown>;

  let rows: Row[];
  let db: D1Database;

  beforeEach(() => {
    rows = [];
    db = {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async first<T>() {
                if (sql.includes("slack_team_id = ?")) {
                  const row = rows.find((r) => r.slack_team_id === args[0]);
                  return (row as T) ?? null;
                }
                if (sql.includes("WHERE id = ?")) {
                  const row = rows.find((r) => r.id === args[0]);
                  return (row as T) ?? null;
                }
                if (sql.includes("dodo_subscription_id = ?")) {
                  const row = rows.find((r) => r.dodo_subscription_id === args[0]);
                  return (row as T) ?? null;
                }
                return null;
              },
              async all<T>() {
                return { results: [...rows] as T[] };
              },
              async run() {
                if (sql.startsWith("INSERT INTO workspaces")) {
                  const [id, slackTeamId, plan, createdAt] = args as string[];
                  if (!rows.some((r) => r.slack_team_id === slackTeamId)) {
                    rows.push({
                      id,
                      slack_team_id: slackTeamId,
                      plan,
                      digest_channel_id: null,
                      digest_cron: "0 13 * * 1-5",
                      quiet_mode: "all_quiet",
                      dodo_customer_id: null,
                      dodo_subscription_id: null,
                      subscription_status: "none",
                      billing_email: null,
                      created_at: createdAt,
                    });
                  }
                }
                if (sql.startsWith("UPDATE workspaces")) {
                  const id = args[args.length - 1] as string;
                  const row = rows.find((r) => r.id === id);
                  if (!row) return { success: true };
                  const setClause = sql.slice(sql.indexOf("SET ") + 4, sql.indexOf(" WHERE"));
                  const columns = setClause.split(", ").map((part) => part.split(" = ")[0]!);
                  for (let i = 0; i < columns.length; i += 1) {
                    const col = columns[i]!;
                    const camel = col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
                    row[col] = args[i];
                    if (camel !== col) row[camel] = args[i];
                  }
                }
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database;
  });

  it("ensureWorkspace inserts then returns the same row on repeat", async () => {
    const store = new D1WorkspaceStore(db);
    const first = await store.ensureWorkspace("T_D1", "trial");
    const second = await store.ensureWorkspace("T_D1", "starter");
    expect(second.id).toBe(first.id);
    expect(second.plan).toBe("trial");
    expect(rows).toHaveLength(1);
  });

  it("updateWorkspace persists billing fields", async () => {
    const store = new D1WorkspaceStore(db);
    const ws = await store.ensureWorkspace("T_BILL", "trial");
    const updated = await store.updateWorkspace(ws.id, {
      plan: "starter",
      subscriptionStatus: "active",
      dodoSubscriptionId: "sub_live",
      billingEmail: "ops@example.com",
    });
    expect(updated?.plan).toBe("starter");
    expect(updated?.subscriptionStatus).toBe("active");
    expect(await store.getWorkspaceBySubscriptionId("sub_live")).toMatchObject({
      id: ws.id,
      plan: "starter",
    });
  });
});
