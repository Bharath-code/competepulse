import { describe, expect, it } from "vitest";
import { browserRunFallback } from "../src/browser.js";

describe("browser fallback honesty (B4)", () => {
  it("returns fixtures when allowFixtures defaults true", async () => {
    const result = await browserRunFallback({
      url: "https://example.com",
      label: "pricing",
    });
    expect(result.provider).toBe("browser");
    expect(result.extracted).toBeTruthy();
  });

  it("throws when fixtures disallowed and no fetchPage", async () => {
    await expect(
      browserRunFallback({
        url: "https://example.com",
        label: "pricing",
        allowFixtures: false,
      }),
    ).rejects.toThrow(/browser_fallback_unavailable/);
  });
});
