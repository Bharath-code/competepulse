import { describe, expect, it } from "vitest";
import { alternatives, concierge, faq, hero, meta, story } from "../src/copy.js";

/**
 * The page makes specific promises (docs/STRATEGY.md, Oct 2026 pivot). These
 * assertions stop a well-meaning copy edit from quietly dropping one.
 */
describe("landing copy", () => {
  const headline = hero.headline.join(" ");

  it("leads with the deal-aware job: a rival move reaches the rep on the deal", () => {
    expect(headline).toMatch(/rival moves/i);
    expect(headline).toMatch(/rep on the deal/i);
    expect(headline).toMatch(/hears first/i);
  });

  it("names HubSpot, Slack, proof and the win/loss loop in the standfirst", () => {
    expect(hero.subhead).toMatch(/HubSpot/);
    expect(hero.subhead).toMatch(/Slack/);
    expect(hero.subhead).toMatch(/proof/i);
    expect(hero.subhead).toMatch(/won/i);
    expect(hero.subhead.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
  });

  it("uses one call-to-action everywhere", () => {
    expect(concierge.ctaLabel).toBe(hero.ctaLabel);
    expect(hero.ctaLabel).toMatch(/^Book a/);
  });

  it("offers five design-partner seats at the strategy price", () => {
    expect(hero.eyebrow).toMatch(/5 design partners/i);
    expect(concierge.title).toMatch(/Five design-partner seats/);
    expect(concierge.body).toMatch(/\$49 a month, locked for a year/);
  });

  it("tells the four-beat story and labels it as example data", () => {
    expect(story.beats.map((b) => b.id)).toEqual(["change", "deals", "dm", "result"]);
    expect(story.caption).toMatch(/example data/i);
  });

  it("answers the competitor-field objection up front", () => {
    expect(faq[0]!.question).toMatch(/don't record competitors/i);
    expect(faq.some((f) => /read-only/i.test(f.answer))).toBe(true);
  });

  it("names the alternatives buyers already priced", () => {
    const names = alternatives.rows.map((row) => row.name).join(" ");
    expect(names).toMatch(/visualping/i);
    expect(names).toMatch(/klue/i);
    expect(names).toMatch(/chatgpt/i);
  });

  it("puts CompetePulse in the same table, with a price", () => {
    expect(alternatives.ours.name).toBe("CompetePulse");
    expect(alternatives.ours.price).toMatch(/\$\d/);
    expect(alternatives.columns).toHaveLength(4);
    for (const row of [...alternatives.rows, alternatives.ours]) {
      expect(Object.values(row).every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it("keeps the meta description within the search-result snippet budget", () => {
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(meta.title.length).toBeLessThanOrEqual(110);
  });
});
