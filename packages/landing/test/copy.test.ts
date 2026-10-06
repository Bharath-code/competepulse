import { describe, expect, it } from "vitest";
import { close, compare, cta, faq, hero, meta, pricing, problem, product } from "../src/copy.js";

/**
 * The page makes specific promises (docs/LANDING_DESIGN.md copy deck). These
 * assertions stop a well-meaning copy edit from quietly dropping one.
 */
describe("landing copy", () => {
  it("leads with the outcome: a rival move reaches the rep on the deal", () => {
    expect(hero.headline).toBe("When a rival moves, the rep on the deal hears first.");
    expect(hero.lead).toMatch(/HubSpot/);
    expect(hero.lead).toMatch(/Slack/);
    expect(hero.lead).toMatch(/proof/);
  });

  it("uses one call-to-action with risk reversal beside it", () => {
    expect(cta.label).toBe("Book a 25-min call");
    expect(cta.reassurance).toMatch(/2 weeks free/);
    expect(cta.reassurance).toMatch(/no card/i);
  });

  it("labels every illustrative example as such", () => {
    expect(hero.caption).toMatch(/^Example:/);
    expect(product.caption).toMatch(/example data/i);
    expect(problem.footnote).toMatch(/illustrative/i);
  });

  it("walks the product in four steps", () => {
    expect(product.steps.map((s) => s.tab)).toEqual(["Watch", "Match", "Message", "Learn"]);
  });

  it("names the alternatives buyers already priced, with a price for each", () => {
    const names = compare.rows.map((r) => `${r.name} ${r.examples}`).join(" ");
    expect(names).toMatch(/visualping/i);
    expect(names).toMatch(/klue/i);
    expect(names).toMatch(/chatgpt/i);
    for (const row of [...compare.rows, compare.ours]) expect(row.price).toMatch(/\S/);
    expect(compare.ours.who).toMatch(/rep/);
  });

  it("publishes prices and today's partner offer", () => {
    expect(pricing.plans.map((p) => p.price)).toEqual(["$0", "$99", "$299", "$699+"]);
    expect(pricing.plans.filter((p) => p.featured)).toHaveLength(1);
    expect(pricing.partner.title).toMatch(/5 design-partner seats/);
    expect(pricing.partner.body).toMatch(/\$49 a month, locked for 12 months/);
  });

  it("answers the competitor-field and data-access objections", () => {
    expect(faq[0]!.question).toMatch(/don't record competitors/i);
    expect(faq.some((f) => /read-only/i.test(f.answer))).toBe(true);
  });

  it("closes on the outcome, not a feature", () => {
    expect(close.title).toMatch(/deals/);
  });

  it("keeps the meta tags within snippet budgets", () => {
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(meta.title.length).toBeLessThanOrEqual(110);
  });
});
