import type { ChangeEvent, ChangeFinding, MaterialityLabel, PricingSnapshot } from "./types.js";

/**
 * Keywords that make a pricing-page feature change "high" materiality rather
 * than "low". Kept intentionally small and auditable — precision beats recall
 * (PRD Product Principle 6: "Materiality over completeness").
 */
const ENTERPRISE_KEYWORDS = [
  "sso",
  "saml",
  "scim",
  "rbac",
  "audit log",
  "audit logs",
  "soc 2",
  "soc2",
  "hipaa",
  "compliance",
  "enterprise",
];

function rank(label: MaterialityLabel): number {
  return label === "high" ? 2 : label === "low" ? 1 : 0;
}

function isEnterpriseFeature(feature: string): boolean {
  const f = feature.toLowerCase();
  return ENTERPRISE_KEYWORDS.some((kw) => f.includes(kw));
}

function formatPrice(value: number | null, currency: string): string {
  if (value === null) return "n/a";
  return `${currency} ${value}`;
}

/**
 * Compare two pricing snapshots and classify the material change between them.
 *
 * Implements the Phase-1 materiality rubric (PRD Appendix B):
 *  - High: price change, plan added/removed, enterprise feature added/removed.
 *  - Low:  non-enterprise feature added/removed, free-trial length change.
 *  - None: first snapshot (baseline) or no detected changes.
 *
 * @param from Previous snapshot, or `null` when this is the first crawl.
 * @param to   Current snapshot.
 * @param url  Source URL, included as a citation on the resulting event.
 */
export function diffPricing(
  from: PricingSnapshot | null,
  to: PricingSnapshot,
  url: string,
): ChangeEvent {
  if (from === null) {
    return {
      materiality: "none",
      summary: "Baseline snapshot recorded.",
      findings: [],
      citations: [url],
    };
  }

  const findings: ChangeFinding[] = [];
  const fromByName = new Map(from.plans.map((p) => [p.name, p]));
  const toByName = new Map(to.plans.map((p) => [p.name, p]));

  for (const [name, fp] of fromByName) {
    const tp = toByName.get(name);
    if (tp === undefined) {
      findings.push({
        kind: "plan_removed",
        materiality: "high",
        summary: `Plan "${name}" was removed.`,
      });
      continue;
    }
    if (fp.price_monthly !== tp.price_monthly) {
      findings.push({
        kind: "price",
        materiality: "high",
        summary: `${name} monthly price changed ${formatPrice(
          fp.price_monthly,
          from.currency,
        )} → ${formatPrice(tp.price_monthly, to.currency)}.`,
      });
    }
    if (fp.price_annual !== tp.price_annual) {
      findings.push({
        kind: "price",
        materiality: "high",
        summary: `${name} annual price changed ${formatPrice(
          fp.price_annual,
          from.currency,
        )} → ${formatPrice(tp.price_annual, to.currency)}.`,
      });
    }
  }

  for (const name of toByName.keys()) {
    if (!fromByName.has(name)) {
      findings.push({
        kind: "plan_added",
        materiality: "high",
        summary: `New plan "${name}" was added.`,
      });
    }
  }

  const fromFeatures = new Set(from.features_called_out.map((f) => f.toLowerCase()));
  const toFeatures = new Set(to.features_called_out.map((f) => f.toLowerCase()));
  for (const feature of toFeatures) {
    if (!fromFeatures.has(feature)) {
      findings.push({
        kind: "feature_added",
        materiality: isEnterpriseFeature(feature) ? "high" : "low",
        summary: `Feature added to pricing page: "${feature}".`,
      });
    }
  }
  for (const feature of fromFeatures) {
    if (!toFeatures.has(feature)) {
      findings.push({
        kind: "feature_removed",
        materiality: isEnterpriseFeature(feature) ? "high" : "low",
        summary: `Feature removed from pricing page: "${feature}".`,
      });
    }
  }

  if (from.free_trial_days !== to.free_trial_days) {
    findings.push({
      kind: "trial",
      materiality: "low",
      summary: `Free trial changed ${from.free_trial_days ?? "none"} → ${
        to.free_trial_days ?? "none"
      } days.`,
    });
  }

  const materiality = findings.reduce<MaterialityLabel>(
    (acc, f) => (rank(f.materiality) > rank(acc) ? f.materiality : acc),
    "none",
  );

  const summary =
    findings.length > 0
      ? findings.map((f) => f.summary).join(" ")
      : "No material changes detected.";

  return { materiality, summary, findings, citations: [url] };
}
