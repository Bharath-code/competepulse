/**
 * Plan caps (PRD §18). Stripe checkout is deferred; caps are still enforced
 * in code so crawl/watch overage cannot happen before billing is wired (E2-6).
 */

export type PlanId = "trial" | "starter" | "pro";

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
  },
  starter: {
    id: "starter",
    name: "Starter",
    competitorLimit: 5,
    urlLimit: 25,
    crawlDailyCap: 50,
    crawlCostCents: 2,
    browserCostCents: 8,
  },
  pro: {
    id: "pro",
    name: "Pro",
    competitorLimit: 25,
    urlLimit: 100,
    crawlDailyCap: 250,
    crawlCostCents: 2,
    browserCostCents: 8,
  },
};

export function planLimits(plan: PlanId = "starter"): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
}

export const UPGRADE_MESSAGE =
  "You've hit your plan URL/competitor limit. Upgrade to Pro for higher caps.";
