import { describe, expect, it } from "vitest";
import { alternatives, concierge, digestPreview, hero, meta } from "../src/copy.js";

/**
 * The brief for P0-3 is specific: one JTBD headline, one sentence of
 * positioning, one call-to-action. These assertions stop a well-meaning copy
 * edit from quietly dropping a required promise.
 */
describe("landing copy", () => {
  const headline = [hero.headline.lead, hero.headline.emphasis, hero.headline.trail].join(" ");

  it("keeps the job-to-be-done headline intact", () => {
    expect(headline).toMatch(/every morning in slack/i);
    expect(headline).toMatch(/materially changed/i);
    expect(headline).toMatch(/with links/i);
  });

  it("states watches, cited digest and both anti-positions in one sentence", () => {
    const sentences = hero.subhead.split(/(?<=\.)\s+/);
    expect(hero.subhead).toMatch(/pricing/i);
    expect(hero.subhead).toMatch(/changelog/i);
    expect(hero.subhead).toMatch(/cited digest/i);
    expect(hero.subhead).toMatch(/klue/i);
    expect(hero.subhead).toMatch(/visualping/i);
    // The pitch sentence plus the two short anti-position lines — no wall of text.
    expect(sentences.length).toBeLessThanOrEqual(3);
  });

  it("uses one call-to-action, and it books a 15-minute call", () => {
    expect(hero.ctaLabel).toBe("Book a 15-min discovery call");
    expect(concierge.ctaLabel).toBe(hero.ctaLabel);
  });

  it("offers the 14-day concierge to three design partners", () => {
    expect(concierge.badge).toMatch(/free 14-day concierge/i);
    expect(concierge.title).toMatch(/3 design partners/i);
    expect(hero.eyebrow).toMatch(/3 design partners/i);
  });

  it("names the alternatives buyers already priced", () => {
    const names = alternatives.columns.map((column) => column.name).join(" ");
    expect(names).toMatch(/visualping/i);
    expect(names).toMatch(/klue/i);
    expect(names).toMatch(/chatgpt/i);
  });

  it("labels the sample digest so nobody reads it as a live customer", () => {
    const competitors = digestPreview.slack.sections.map((s) => s.competitor);
    expect(competitors).toContain("Acme");
    expect(digestPreview.slack.digestTitle).toBe("CompetePulse digest");
    expect(digestPreview.slack.digestDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps the meta description within the search-result snippet budget", () => {
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(meta.title.length).toBeLessThanOrEqual(110);
  });
});
