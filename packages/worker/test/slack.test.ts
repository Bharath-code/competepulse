import { describe, expect, it } from "vitest";
import { parseSlashForm, verifySlackSignature } from "../src/slack.js";

describe("slack helpers", () => {
  it("parses slash command form bodies", () => {
    const payload = parseSlashForm(
      "team_id=T1&channel_id=C1&user_id=U1&command=%2Fcompete&text=watch+list",
    );
    expect(payload).toMatchObject({
      team_id: "T1",
      command: "/compete",
      text: "watch list",
    });
  });

  it("allows requests when signing secret is unset (local/dev)", async () => {
    const req = new Request("http://localhost/slack/commands", { method: "POST" });
    expect(await verifySlackSignature(undefined, req, "body")).toBe(true);
  });

  it("rejects missing signature headers when secret is set", async () => {
    const req = new Request("http://localhost/slack/commands", { method: "POST" });
    expect(await verifySlackSignature("secret", req, "body")).toBe(false);
  });
});
