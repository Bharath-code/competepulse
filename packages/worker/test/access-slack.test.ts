import { describe, expect, it } from "vitest";
import { authorizeRequest, constantTimeEqual, planAllowsMutations } from "../src/access.js";
import { slackPostMessage } from "../src/slack-api.js";

describe("access gate (B5)", () => {
  it("allows requests when token unset only in local", () => {
    const req = new Request("https://example.com/dashboard");
    expect(authorizeRequest(req, { ENVIRONMENT: "local" })).toEqual({ ok: true });
    expect(authorizeRequest(req, {})).toMatchObject({ ok: false, status: 503 });
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

  it("rejects ?access_token= even when the token is valid", () => {
    const req = new Request("https://example.com/dashboard?access_token=secret");
    expect(authorizeRequest(req, { DASHBOARD_ACCESS_TOKEN: "secret" })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("constantTimeEqual handles equal, differing and different-length inputs", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
