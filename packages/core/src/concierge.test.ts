import { describe, expect, it } from "vitest";
import { matchDeals, parseCsv, renderDms, toDeals } from "./concierge.ts";

const csv = [
  "name,owner_email,stage,amount,competitor",
  ...Array.from({ length: 44 }, (_, i) => `Other ${i},x@a.com,Qualified,1000,Foo`),
  '"Acme ""Big"" Co",Ann@A.com,Proposal,"$12,000",Rival',
  "Beta,ann@a.com,Demo,5000,Rival; Foo",
  "Gamma,bob@a.com,Negotiation,,rival",
  "Done,bob@a.com,Closed Won,9000,Rival",
  "Lost,bob@a.com,closedlost,9000,Rival",
  "Prefix,bob@a.com,Demo,100,Rivalry",
].join("\n");

const change = {
  rival: "Rival",
  summary: "Pro plan up 20%",
  findings: [{ summary: "Pro $49 → $59" }],
  citations: ["https://rival.com/pricing"],
};

describe("concierge", () => {
  const deals = matchDeals(toDeals(parseCsv(csv)), "Rival");
  it("matches open deals only, exact competitor", () => {
    expect(deals.map((d) => d.name)).toEqual(['Acme "Big" Co', "Beta", "Gamma"]);
    expect(deals[0]?.amount).toBe(12000);
  });
  it("groups DMs by owner with source and line", () => {
    const out = renderDms(deals, change);
    expect(out.match(/^## To:/gm)).toHaveLength(2);
    expect(out).toContain("https://rival.com/pricing");
    expect(out).toContain("Say this:");
  });
});
