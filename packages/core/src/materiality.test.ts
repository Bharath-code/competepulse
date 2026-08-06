import { describe, expect, it } from "vitest";
import { diffPricing } from "./materiality.js";
import type { PricingSnapshot } from "./types.js";

const base: PricingSnapshot = {
  currency: "USD",
  plans: [
    { name: "Starter", price_monthly: 49, price_annual: 39, unit: "seat" },
    { name: "Pro", price_monthly: 99, price_annual: 79, unit: "seat" },
  ],
  features_called_out: ["Analytics", "Integrations"],
  free_trial_days: 14,
  notes: [],
};

const url = "https://acme.example/pricing";

function clone(s: PricingSnapshot): PricingSnapshot {
  return JSON.parse(JSON.stringify(s)) as PricingSnapshot;
}

describe("diffPricing", () => {
  it("returns 'none' for the baseline (first) snapshot", () => {
    const event = diffPricing(null, base, url);
    expect(event.materiality).toBe("none");
    expect(event.findings).toHaveLength(0);
    expect(event.citations).toEqual([url]);
  });

  it("returns 'none' when nothing changed", () => {
    const event = diffPricing(base, clone(base), url);
    expect(event.materiality).toBe("none");
    expect(event.summary).toBe("No material changes detected.");
  });

  it("flags a monthly price change as 'high'", () => {
    const next = clone(base);
    next.plans[1].price_monthly = 129;
    const event = diffPricing(base, next, url);
    expect(event.materiality).toBe("high");
    expect(event.findings.some((f) => f.kind === "price")).toBe(true);
    expect(event.summary).toContain("129");
  });

  it("flags an added plan as 'high'", () => {
    const next = clone(base);
    next.plans.push({ name: "Enterprise", price_monthly: null, price_annual: null, unit: "seat" });
    const event = diffPricing(base, next, url);
    expect(event.materiality).toBe("high");
    expect(event.findings.some((f) => f.kind === "plan_added")).toBe(true);
  });

  it("flags a removed plan as 'high'", () => {
    const next = clone(base);
    next.plans = next.plans.filter((p) => p.name !== "Pro");
    const event = diffPricing(base, next, url);
    expect(event.materiality).toBe("high");
    expect(event.findings.some((f) => f.kind === "plan_removed")).toBe(true);
  });

  it("treats an enterprise feature addition as 'high' but a minor feature as 'low'", () => {
    const highNext = clone(base);
    highNext.features_called_out.push("SSO");
    expect(diffPricing(base, highNext, url).materiality).toBe("high");

    const lowNext = clone(base);
    lowNext.features_called_out.push("Dark mode");
    expect(diffPricing(base, lowNext, url).materiality).toBe("low");
  });

  it("treats a free-trial length change as 'low'", () => {
    const next = clone(base);
    next.free_trial_days = 7;
    const event = diffPricing(base, next, url);
    expect(event.materiality).toBe("low");
    expect(event.findings[0]?.kind).toBe("trial");
  });
});
