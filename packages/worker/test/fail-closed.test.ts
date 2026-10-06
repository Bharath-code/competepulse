import { describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/app.js";

const app = createApp();
const prod: Env = { ENVIRONMENT: "production" };
const local: Env = { ENVIRONMENT: "local" };

describe("fail closed on missing secrets", () => {
  it.each(["/slack/commands", "/slack/interactions", "/billing/webhooks/dodo"])(
    "%s returns 503 in prod without its secret",
    async (path) => {
      const res = await app.request(path, { method: "POST", body: "x" }, prod);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "secret_missing" });
    },
  );

  it("dashboard gate returns 503 in prod without DASHBOARD_ACCESS_TOKEN", async () => {
    const res = await app.request("/workspaces", {}, prod);
    expect(res.status).toBe(503);
  });

  it("local still passes the gates", async () => {
    const res = await app.request("/workspaces", {}, local);
    expect(res.status).toBe(200);
  });
});
