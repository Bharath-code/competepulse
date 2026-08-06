import type { MaterialityLabel, PricingSnapshot } from "../types.js";

export interface EvalCase {
  /** Stable fixture id — maps to a "page" in the 20-page golden set (E5-1). */
  name: string;
  url: string;
  pageKind: "pricing" | "changelog";
  from: PricingSnapshot;
  to: PricingSnapshot;
  expected: MaterialityLabel;
  /** Optional golden markdown excerpt representing the page body. */
  markdown?: string;
}

function base(name: string, monthly: number, features: string[] = []): PricingSnapshot {
  return {
    currency: "USD",
    plans: [
      {
        name: "Starter",
        price_monthly: Math.max(19, monthly - 50),
        price_annual: null,
        unit: "seat",
      },
      { name: name, price_monthly: monthly, price_annual: Math.round(monthly * 0.8), unit: "seat" },
    ],
    features_called_out: features,
    free_trial_days: 14,
    notes: [],
  };
}

function withEdit(source: PricingSnapshot, edit: (s: PricingSnapshot) => void): PricingSnapshot {
  const copy = JSON.parse(JSON.stringify(source)) as PricingSnapshot;
  edit(copy);
  return copy;
}

const acme = base("Pro", 99, ["Analytics", "Integrations"]);
const bolt = base("Growth", 79, ["API access"]);
const crest = base("Team", 59, ["Shared inbox"]);
const delta = base("Business", 149, ["SSO", "Audit logs"]);
const echo = base("Plus", 39, ["Templates"]);

/**
 * 20-page golden eval set (PRD Appendix F / E5-1). Each case pairs two
 * extracted snapshots with the materiality label a human reviewer would assign.
 */
export const EVAL_CASES: EvalCase[] = [
  {
    name: "acme-no-change",
    url: "https://acme.example/pricing",
    pageKind: "pricing",
    from: acme,
    to: withEdit(acme, () => {}),
    expected: "none",
    markdown: "# Acme Pricing\nPro $99/seat",
  },
  {
    name: "acme-pro-price-hike",
    url: "https://acme.example/pricing",
    pageKind: "pricing",
    from: acme,
    to: withEdit(acme, (s) => (s.plans[1].price_monthly = 129)),
    expected: "high",
    markdown: "# Acme Pricing\nPro $129/seat",
  },
  {
    name: "acme-enterprise-plan",
    url: "https://acme.example/pricing",
    pageKind: "pricing",
    from: acme,
    to: withEdit(acme, (s) =>
      s.plans.push({ name: "Enterprise", price_monthly: null, price_annual: null, unit: "seat" }),
    ),
    expected: "high",
  },
  {
    name: "acme-starter-removed",
    url: "https://acme.example/pricing",
    pageKind: "pricing",
    from: acme,
    to: withEdit(acme, (s) => (s.plans = s.plans.filter((p) => p.name !== "Starter"))),
    expected: "high",
  },
  {
    name: "acme-sso-added",
    url: "https://acme.example/pricing",
    pageKind: "pricing",
    from: acme,
    to: withEdit(acme, (s) => s.features_called_out.push("SSO")),
    expected: "high",
  },
  {
    name: "acme-audit-logs",
    url: "https://acme.example/pricing",
    pageKind: "pricing",
    from: acme,
    to: withEdit(acme, (s) => s.features_called_out.push("Audit logs")),
    expected: "high",
  },
  {
    name: "acme-dark-mode",
    url: "https://acme.example/pricing",
    pageKind: "pricing",
    from: acme,
    to: withEdit(acme, (s) => s.features_called_out.push("Dark mode")),
    expected: "low",
  },
  {
    name: "acme-trial-shortened",
    url: "https://acme.example/pricing",
    pageKind: "pricing",
    from: acme,
    to: withEdit(acme, (s) => (s.free_trial_days = 7)),
    expected: "low",
  },
  {
    name: "bolt-price-cut",
    url: "https://bolt.example/pricing",
    pageKind: "pricing",
    from: bolt,
    to: withEdit(bolt, (s) => (s.plans[1].price_monthly = 49)),
    expected: "high",
  },
  {
    name: "bolt-annual-change",
    url: "https://bolt.example/pricing",
    pageKind: "pricing",
    from: bolt,
    to: withEdit(bolt, (s) => (s.plans[1].price_annual = 39)),
    expected: "high",
  },
  {
    name: "bolt-saml-added",
    url: "https://bolt.example/pricing",
    pageKind: "pricing",
    from: bolt,
    to: withEdit(bolt, (s) => s.features_called_out.push("SAML")),
    expected: "high",
  },
  {
    name: "bolt-minor-feature",
    url: "https://bolt.example/pricing",
    pageKind: "pricing",
    from: bolt,
    to: withEdit(bolt, (s) => s.features_called_out.push("Keyboard shortcuts")),
    expected: "low",
  },
  {
    name: "crest-no-change",
    url: "https://crest.example/pricing",
    pageKind: "pricing",
    from: crest,
    to: withEdit(crest, () => {}),
    expected: "none",
  },
  {
    name: "crest-plan-added",
    url: "https://crest.example/pricing",
    pageKind: "pricing",
    from: crest,
    to: withEdit(crest, (s) =>
      s.plans.push({ name: "Scale", price_monthly: 199, price_annual: 159, unit: "seat" }),
    ),
    expected: "high",
  },
  {
    name: "crest-hipaa",
    url: "https://crest.example/pricing",
    pageKind: "pricing",
    from: crest,
    to: withEdit(crest, (s) => s.features_called_out.push("HIPAA")),
    expected: "high",
  },
  {
    name: "delta-sso-removed",
    url: "https://delta.example/pricing",
    pageKind: "pricing",
    from: delta,
    to: withEdit(
      delta,
      (s) => (s.features_called_out = s.features_called_out.filter((f) => f !== "SSO")),
    ),
    expected: "high",
  },
  {
    name: "delta-trial-extended",
    url: "https://delta.example/pricing",
    pageKind: "pricing",
    from: delta,
    to: withEdit(delta, (s) => (s.free_trial_days = 30)),
    expected: "low",
  },
  {
    name: "echo-price-hike",
    url: "https://echo.example/pricing",
    pageKind: "pricing",
    from: echo,
    to: withEdit(echo, (s) => (s.plans[1].price_monthly = 59)),
    expected: "high",
  },
  {
    name: "echo-scim-added",
    url: "https://echo.example/pricing",
    pageKind: "pricing",
    from: echo,
    to: withEdit(echo, (s) => s.features_called_out.push("SCIM")),
    expected: "high",
  },
  {
    name: "echo-cosmetic-feature",
    url: "https://echo.example/pricing",
    pageKind: "pricing",
    from: echo,
    to: withEdit(echo, (s) => s.features_called_out.push("Custom themes")),
    expected: "low",
  },
];

if (EVAL_CASES.length !== 20) {
  throw new Error(`E5-1 requires 20 eval fixtures; found ${EVAL_CASES.length}`);
}
