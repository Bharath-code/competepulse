import { describe, expect, it } from "vitest";
import { authorizeRequest, planAllowsMutations } from "../src/access.js";
import { slackPostMessage } from "../src/slack-api.js";

describe("access gate (B5)", () => {
  it("allows all requests when token unset", () => {
    const req = new Request("https://example.com/dashboard");
    expect(authorizeRequest(req, {})).toEqual({ ok: true });
  });

  it("rejects missing bearer when token set", () => {
    const req = new Request("https://example.com/dashboard");
    expect(authorizeRequest(req, { DASHBOARD_ACCESS_TOKEN: "secret" })).toEqual({
      ok: false,
      status: 401,
      error: "unauthorized",
    });
  });

  it("accepts bearer token", () => {
    const req = new Request("https://example.com/dashboard", {
      headers: { authorization: "Bearer secret" },
    });
    expect(authorizeRequest(req, { DASHBOARD_ACCESS_TOKEN: "secret" })).toEqual({ ok: true });
  });

  it("blocks cancelled subscriptions from mutations", () => {
    expect(planAllowsMutations("cancelled", "pro")).toBe(false);
    expect(planAllowsMutations("none", "trial")).toBe(true);
    expect(planAllowsMutations("active", "starter")).toBe(true);
  });
});

describe("slackPostMessage (B2)", () => {
  it("posts chat.postMessage and returns ts", async () => {
    const result = await slackPostMessage({
      token: "xoxb-test",
      channel: "C123",
      text: "hello",
      fetchImpl: async () =>
        new Response(JSON.stringify({ ok: true, ts: "1.2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    expect(result).toEqual({ ok: true, ts: "1.2" });
  });

  it("surfaces Slack API errors", async () => {
    const result = await slackPostMessage({
      token: "xoxb-test",
      channel: "C123",
      text: "hello",
      fetchImpl: async () =>
        new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    expect(result).toEqual({ ok: false, error: "channel_not_found" });
  });
});
