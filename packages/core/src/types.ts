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

/** Structured extraction of a changelog / release notes page (E2-2). */
export interface ChangelogEntry {
  date: string | null;
  title: string;
  summary: string | null;
  tags: string[];
}

export interface ChangelogSnapshot {
  entries: ChangelogEntry[];
  notes: string[];
}

/** Union of extract payloads we persist on snapshots. */
export type ExtractSnapshot = PricingSnapshot | ChangelogSnapshot;

export function isPricingSnapshot(value: ExtractSnapshot): value is PricingSnapshot {
  return "plans" in value && Array.isArray(value.plans);
}

export function isChangelogSnapshot(value: ExtractSnapshot): value is ChangelogSnapshot {
  return "entries" in value && Array.isArray(value.entries);
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
  fromSnapshotId?: string;
  toSnapshotId?: string;
}

export type UsageMetric = "crawl" | "browser" | "llm_tokens";
