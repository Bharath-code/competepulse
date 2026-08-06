/**
 * Domain types for CompetePulse. Mirrors the PRD data model (§13) and the
 * SaaS pricing extraction schema (v1).
 */

export type MaterialityLabel = "none" | "low" | "high";

export type WatchLabel = "pricing" | "changelog" | "docs" | "careers" | "other";

/** A single plan row extracted from a pricing page. */
export interface PricingPlan {
  name: string;
  price_monthly: number | null;
  price_annual: number | null;
  unit: string | null;
}

/** Structured extraction of a SaaS pricing page (PRD §13, "SaaS pricing schema — v1"). */
export interface PricingSnapshot {
  currency: string;
  plans: PricingPlan[];
  features_called_out: string[];
  free_trial_days: number | null;
  notes: string[];
}

export type ChangeKind =
  "price" | "plan_added" | "plan_removed" | "feature_added" | "feature_removed" | "trial";

/** One atomic difference found between two snapshots. */
export interface ChangeFinding {
  kind: ChangeKind;
  materiality: MaterialityLabel;
  summary: string;
}

/** Aggregated, cited change event between two snapshots (PRD ChangeEvent). */
export interface ChangeEvent {
  materiality: MaterialityLabel;
  summary: string;
  findings: ChangeFinding[];
  citations: string[];
}
