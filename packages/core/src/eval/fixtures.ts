import type { MaterialityLabel, PricingSnapshot } from "../types.js";

export interface EvalCase {
  name: string;
  url: string;
  from: PricingSnapshot;
  to: PricingSnapshot;
  expected: MaterialityLabel;
}

const acme: PricingSnapshot = {
  currency: "USD",
  plans: [
    { name: "Starter", price_monthly: 49, price_annual: 39, unit: "seat" },
    { name: "Pro", price_monthly: 99, price_annual: 79, unit: "seat" },
  ],
  features_called_out: ["Analytics", "Integrations"],
  free_trial_days: 14,
  notes: [],
};

function withEdit(edit: (s: PricingSnapshot) => void): PricingSnapshot {
  const copy = JSON.parse(JSON.stringify(acme)) as PricingSnapshot;
  edit(copy);
  return copy;
}

/**
 * A tiny eval fixture set (a stand-in for the 20-page golden set described in
 * PRD Appendix F / roadmap E5-1). Each case pairs two snapshots with the
 * materiality label a human reviewer would assign.
 */
export const EVAL_CASES: EvalCase[] = [
  {
    name: "no change",
    url: "https://acme.example/pricing",
    from: acme,
    to: withEdit(() => {}),
    expected: "none",
  },
  {
    name: "pro monthly price hike",
    url: "https://acme.example/pricing",
    from: acme,
    to: withEdit((s) => (s.plans[1].price_monthly = 129)),
    expected: "high",
  },
  {
    name: "new enterprise plan",
    url: "https://acme.example/pricing",
    from: acme,
    to: withEdit((s) =>
      s.plans.push({ name: "Enterprise", price_monthly: null, price_annual: null, unit: "seat" }),
    ),
    expected: "high",
  },
  {
    name: "starter plan removed",
    url: "https://acme.example/pricing",
    from: acme,
    to: withEdit((s) => (s.plans = s.plans.filter((p) => p.name !== "Starter"))),
    expected: "high",
  },
  {
    name: "sso added to pricing page",
    url: "https://acme.example/pricing",
    from: acme,
    to: withEdit((s) => s.features_called_out.push("SSO")),
    expected: "high",
  },
  {
    name: "audit logs added",
    url: "https://acme.example/pricing",
    from: acme,
    to: withEdit((s) => s.features_called_out.push("Audit logs")),
    expected: "high",
  },
  {
    name: "minor feature wording added",
    url: "https://acme.example/pricing",
    from: acme,
    to: withEdit((s) => s.features_called_out.push("Dark mode")),
    expected: "low",
  },
  {
    name: "free trial shortened",
    url: "https://acme.example/pricing",
    from: acme,
    to: withEdit((s) => (s.free_trial_days = 7)),
    expected: "low",
  },
];
