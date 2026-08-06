/**
 * Plan caps (PRD §18) + commercial prices for Dodo Payments (E4-1 / E2-6).
 * Caps are enforced in code; paid plans are activated via Dodo webhooks.
 */

export type PlanId = "trial" | "starter" | "pro";

/** Paid plans that can be purchased via Dodo checkout. */
export type PaidPlanId = "starter" | "pro";

export interface PlanLimits {
  id: PlanId;
  name: string;
  competitorLimit: number;
  urlLimit: number;
  /** Soft daily crawl budget used by the cost meter (E5-3). */
  crawlDailyCap: number;
  /** Estimated cents charged per Firecrawl scrape for founder cost views. */
  crawlCostCents: number;
  /** Estimated cents charged per Browser Run fallback. */
  browserCostCents: number;
  /** List price in USD cents (null for trial). */
  priceMonthlyCents: number | null;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  trial: {
    id: "trial",
    name: "Trial",
    competitorLimit: 5,
    urlLimit: 25,
    crawlDailyCap: 50,
    crawlCostCents: 2,
    browserCostCents: 8,
    priceMonthlyCents: null,
  },
  starter: {
    id: "starter",
    name: "Starter",
    competitorLimit: 5,
    urlLimit: 25,
    crawlDailyCap: 50,
    crawlCostCents: 2,
    browserCostCents: 8,
    priceMonthlyCents: 14_900,
  },
  pro: {
    id: "pro",
    name: "Pro",
    competitorLimit: 25,
    urlLimit: 100,
    crawlDailyCap: 250,
    crawlCostCents: 2,
    browserCostCents: 8,
    priceMonthlyCents: 39_900,
  },
};

export function planLimits(plan: PlanId = "starter"): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
}

export function isPaidPlan(plan: string): plan is PaidPlanId {
  return plan === "starter" || plan === "pro";
}

export const UPGRADE_MESSAGE =
  "You've hit your plan URL/competitor limit. Upgrade to Pro for higher caps.";
