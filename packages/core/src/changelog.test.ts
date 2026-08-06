import { describe, expect, it } from "vitest";
import { diffChangelog } from "./changelog.js";
import type { ChangelogSnapshot } from "./types.js";

const base: ChangelogSnapshot = {
  entries: [{ date: "2026-07-01", title: "Launch analytics", summary: null, tags: ["feature"] }],
  notes: [],
};

describe("diffChangelog", () => {
  it("baselines the first snapshot as none", () => {
    expect(diffChangelog(null, base, "https://acme.example/changelog").materiality).toBe("none");
  });

  it("flags a new entry as high", () => {
    const next: ChangelogSnapshot = {
      entries: [
        ...base.entries,
        {
          date: "2026-08-01",
          title: "SSO for all plans",
          summary: "Enterprise SSO",
          tags: ["security"],
        },
      ],
      notes: [],
    };
    const event = diffChangelog(base, next, "https://acme.example/changelog");
    expect(event.materiality).toBe("high");
    expect(event.summary).toContain("SSO for all plans");
  });
});
