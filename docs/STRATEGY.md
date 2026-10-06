# CompetePulse Strategy — Oct 2026

**Decision:** stop selling "competitor alerts" (a commodity) and sell **competitive response tied to pipeline**: when a competitor moves, tell the reps whose open deals it touches, what changed (with proof), and what to say — then measure whether those deals were won.

Builds on [FIELD_AUDIT_2026-10.md](FIELD_AUDIT_2026-10.md). Every claim is tagged **[S]** sourced (see Sources) or **[A]** assumption to validate.

---

## 1. What changed since the audit

The audit's pick (shared SaaS pricing index, Option B) is **already taken**:

| Player | What they have | Price | Implication |
| --- | --- | --- | --- |
| [PricingSaaS Pulse](https://www.pricingsaas.com/pricing) | 3,000+ pricing pages, full change history, annotated screenshots, **MCP**, watchlists, digests, quarterly trend reports, pricing experts | Free (200 credits) · Pro from $25/mo [S] | Pricing data is a commodity input. Don't rebuild it. |
| [SaaS PricePulse](https://www.saaspricepulse.com/) | 260+ tools, "18 years" history, Email/Slack/Telegram alerts, AI chat | Beta/free [S] | Same |
| [GetPricePulse](https://www.getpricepulse.com/pricing-tracker.html) | Public price-hike tracker, buyer-side alerts | Low-cost [S] | Owns "SaaS price hike" SEO |
| [Firecrawl Monitor](https://docs.firecrawl.dev/features/monitoring) | Page/site/**web-search** monitors, LLM `goal` judge, field-level JSON diffs, webhook/email/**Slack** | 1 credit/check + 1/judged change [S] | Our vendor sells "alerts in Slack" as an API |
| [Kompyte](https://www.saashero.net/competitor/best-competitive-intelligence-tools-2026/) | Battlecards + HubSpot/Salesforce/Slack | ~$300/mo Essentials [S] | Closest to the new wedge; sales-led, battlecard CMS |
| Klue / Crayon | Deal-level intel in Salesforce, Compete Agent | $20–40k/yr [S] | Proves the job is worth money; won't sell to 50-person companies |

**Conclusion:** monitoring, diffing, AI noise filtering, Slack delivery and pricing history are all commodities in 2026. Anything built only on them gets replaced by a cheaper tool or a Firecrawl + n8n template.

## 2. The gap to exploit

Every tool under $5k/yr answers *"what did competitors change?"* Only $20k+ tools answer *"which of my deals does this hit, and what do my reps say?"* That middle is the gap.

| Layer | Who owns it | Our stance |
| --- | --- | --- |
| Fetch + diff + "is it meaningful" | Firecrawl, Visualping, everyone | **Buy** (Firecrawl Monitor) |
| Pricing history across SaaS | PricingSaaS, PricePulse | **Partner / ignore** (optionally consume via MCP) |
| Change → *your* open deals → *your* reps | Klue, Crayon (enterprise only) | **Own** — the wedge |
| Approved response (talk track, battlecard line, counter-offer) | Klue, Kompyte | **Own** — habit + switching cost |
| Outcome: did deals vs competitor X get won after the response? | Nobody below enterprise | **Own** — the moat |

**Beachhead ICP [A — validate in calls]:** B2B SaaS, 20–200 employees, **HubSpot CRM**, Slack-first, 1–2 person PMM or founder-led sales, in **fast-moving AI/devtools categories** where competitors change pricing and packaging monthly (PricingSaaS Q2 2026: 1 in 5 companies made AI pricing changes [S]; e.g. Cursor +60%, Sentry +208%, Vercel +25% in 2026 [S]).

Why HubSpot first: mid-market lives there, Klue/Crayon lead with Salesforce, and the HubSpot App Marketplace is a distribution channel on its own.

## 3. Positioning — how we avoid being a commodity

- **Category:** deal-aware competitive intelligence.
- **One-liner:** *"When a competitor moves, CompetePulse tells the reps whose deals it touches — with proof and a talk track."*
- **Against Unkover/Visualping/Firecrawl:** they alert a channel; we alert the deal owner, with the deal named.
- **Against Klue/Crayon:** same deal-level outcome, self-serve in 10 minutes, ~10× cheaper, no CI owner needed.
- **Against PricingSaaS:** they're research for pricing teams; we're action for sellers. Complementary — pitch a data partnership, not a fight.

Non-commodity assets to compound (in priority order):

1. **Private context join** — HubSpot deals with competitor field, call notes, lost reasons joined to public changes. A scraper can't copy what it can't see.
2. **Response loop** — draft → approve in Slack → posted to deal/rep. Approved content accumulates in our system; leaving means losing it.
3. **Outcome data** — win rate per competitor before/after each move, across customers (anonymized benchmarks: "teams vs X win 34%"). Network effect: more customers → better "what works against X".
4. **Trust** — published precision on real labelled pages, screenshot evidence, citations. When everyone generates content, verified beats fast.
5. **Agent distribution** — MCP server so the customer's own agents (Claude, ChatGPT, HubSpot Breeze) query *our* competitive memory.

## 4. Use Firecrawl to its full potential

Rule: **don't rebuild what Firecrawl sells; own what it doesn't** (history, customer context, response, outcomes). Firecrawl CLI here is authenticated (~50k credits).

| Firecrawl capability | Product feature | Why it matters |
| --- | --- | --- |
| `map` (+`--search`) | Type a competitor domain → auto-find pricing, changelog, docs, careers, blog, status URLs | Zero-config onboarding; watchlist in ~60s (activation) |
| `scrape` JSON / `agent` | Instant competitor dossier at install (plans, positioning, ICP claims, recent launches) | "Aha" in the first session, before any change happens |
| `monitor` page + `changeTracking` JSON mode + `goal` | Field-level pricing/packaging diffs judged as meaningful, webhook → Worker | Replaces our cron/queue crawl (also fixes the digest race); our `diffPricing` becomes the schema layer |
| `monitor` crawl target | Whole changelog/docs site diffs → auto feature-parity matrix | Messaging and feature moves, not just price |
| `monitor` **search** target (`--queries` + `--goal`) | Web-wide: launches, funding, exec hires, layoffs, G2/Reddit/HN complaints about a competitor | **Displacement signals**: unhappy competitor customers = pipeline for the customer's SDRs. CI that creates revenue, not only defends it |
| `screenshot` format | Before/after image in every Slack alert | Proof → trust → forwarding |
| `location` (country) | Regional/PPP pricing (India, EU, LatAm) | Business-tier add-on; almost nobody tracks it [A] |
| `interact` | Pricing calculators, monthly/annual toggles, public checkout totals | Real price vs list price. Public pages only; respect ToS and robots |
| `parse` | Ingest customer's old battlecards, win/loss decks (PDF/DOCX) | Private context on day 1 |
| `search` (news, time filters) | Fresh grounding for Q&A answers | Answers cite this week, not last quarter |
| `maxAge` cache + one crawl per URL across tenants | Shared fetch, per-tenant interpretation | COGS stays ~$1–5/workspace/mo [A] |

**Founder GTM uses (same CLI, this repo):**

- `firecrawl-lead-gen` / `search` → build the ICP list (AI/devtools SaaS on HubSpot, with a pricing page and a PMM).
- **Signal-based outbound:** monitor each prospect's competitors; when one moves, email the prospect the diff. The product's output *is* the cold email.
- `firecrawl-seo-audit` on the landing page; `firecrawl-market-research` for quarterly reports.

Risk: Firecrawl competes upward and sees our watchlists. Mitigation: keep the provider interface, store every snapshot in R2 ourselves, keep the response/outcome layers vendor-independent.

## 5. Product strategy (sequenced, gated)

| When | Ship | Gate to continue |
| --- | --- | --- |
| Week 1 | Fix 3 critical + 6 high findings from the audit. CI green, branch protection on. Migrate to Firecrawl v2 + Monitor webhooks. | No design partner touches prod before this |
| Weeks 1–2 | Concierge: run the loop by hand for 5 prospects (their competitors, their HubSpot export) | ≥5 of 20 calls rank "competitor move hits live deals" as top-3 pain |
| Weeks 3–6 | Onboarding: domain → `map` → auto watchlist → dossier. HubSpot OAuth (read deals + competitor property). Deal-aware alert to deal owner in Slack. | ≥3 paying design partners |
| Weeks 7–10 | Response drafts (LLM, cited) + approve-in-Slack. Search monitors for displacement signals. Real-page eval set: 100 labels, ≥90% precision, published | ≥60% of alerts get an action (approve/forward/dismiss) |
| Weeks 11–13 | Win/loss tagging + per-competitor win-rate view. MCP server. Slack Marketplace + HubSpot Marketplace submissions | $1.5k MRR, ≥1 case study with a deal outcome |

Cut until 10 customers ask: battlecard CMS, web dashboard beyond settings, Teams, Salesforce, Q&A over full history.

North-star metric: **deals touched by an approved response per week.** Supporting: time-to-first-alert <24h, alert precision ≥90%, weekly active Slack channels, free→paid ≥2%.

## 6. Revenue strategy

| Plan | Price | Includes | Role |
| --- | --- | --- | --- |
| Free | $0 | 2 competitors, weekly Slack digest, dossier | Acquisition; spreads inside Slack |
| Starter | $99/mo | 5 competitors, daily alerts, screenshots, search signals | Self-serve PMM/founder |
| Team | $299/mo | 15 competitors, **HubSpot deal-aware alerts**, response drafts, MCP, win/loss | Core plan; priced at Kompyte Essentials, self-serve |
| Business | $699+/mo | Unlimited, regional pricing, custom signals, API, Salesforce later | Expansion |
| Agency | $499/mo | Multi-client workspaces for PMM/pricing consultants | Channel |

- **Design partners:** $49/mo locked 12 months for weekly feedback + case study. Charge from day one.
- **Annual:** 2 months free; push at month 2 when the first win/loss data appears.
- **Unseated pricing** (value metric = competitors + CRM): more users in Slack spreads the product, never taxes it.
- **Don't race Unkover to $79.** The free tier absorbs price-sensitive buyers; paid tiers sell pipeline outcomes.
- **Later revenue:** anonymized benchmark reports (sponsor model, as PricingSaaS does with partners [S]); paid API/MCP data access.
- **Unit economics [A]:** Starter ≈ 30 URLs × daily 1-credit checks + judged changes + 5 daily search monitors ≈ 1.5k credits ≈ $1.50/mo + LLM ≈ $3. Gross margin >95%. Infra breakeven = 2 Starter customers.

## 7. Marketing strategy

1. **Signal-based outbound (core, from day 1).** 10/day. "Your competitor X changed Y on <date> — screenshot attached. 3 deals in a pipeline like yours usually hear about this from the prospect first." → 20 calls in 3 weeks. Tools: Firecrawl lead-gen + monitors, Gmail MCP drafts, Calendar.
2. **Free tool as lead magnet:** "Competitor Move Report" — enter your domain → we find your top competitors and show 90 days of their changes. Email-gated full report → Slack install. (skills: `free-tool-strategy`, `lead-magnets`)
3. **Programmatic SEO on *response*, not history** (history SEO is taken): "How to respond when [Competitor] raises prices", "[X] vs [Y]: what changed this quarter". (skill: `programmatic-seo`)
4. **Founder-led LinkedIn, weekly:** "AI SaaS competitive moves this week + what I'd tell reps." Data from our own monitors.
5. **Marketplaces:** Slack Marketplace (also lifts the 2025 rate limits [S]), HubSpot App Marketplace, MCP directories, Firecrawl customer showcase.
6. **Communities:** Product Marketing Alliance, Pavilion, r/ProductMarketing, AI/devtools founder Slacks.
7. **Partners:** fractional PMMs and pricing consultants (20% rev share via Agency plan); pitch PricingSaaS a data partnership.
8. **Launch** (Product Hunt, HN Show) only after 10 paying customers and a published precision number.

Analytics: PostHog funnels (install → first alert → first approved response → paid) from the first user.

## 8. Path to owning the niche

1. **Beachhead (0–6 mo):** HubSpot + AI/devtools SaaS. Target 50 paying, $10k MRR [A]. Be the default answer to "how do small teams do Klue-style deal intel?"
2. **Adjacent (6–18 mo):** other fast-moving verticals (fintech, martech, security SaaS); Salesforce; agencies.
3. **Platform (18+ mo):** benchmark data network ("win rates vs X across 300 teams"), MCP as the competitive memory for GTM agents.

"Dominating" means owning that beachhead, not out-spending Klue. The beachhead is won by: fastest setup (minutes), highest published precision, the only tool under $5k that names the deal.

## 9. Kill criteria and risks

- **Day 21:** <5 of 20 calls rank deal-level competitive response top-3 → fall back to Option C (AI-answer monitor) or Option E (portfolio).
- **Day 45:** <3 paying design partners → stop building, re-interview.
- **Day 90:** <$750 MRR or <1.5% free→paid → stop GTM spend.

| Risk | Mitigation |
| --- | --- |
| Firecrawl moves up-stack | Provider interface; own snapshots in R2; value lives in CRM join + outcomes |
| Kompyte/Klue go self-serve | Speed + price + HubSpot-native; publish outcome benchmarks first |
| HubSpot API scopes / review | Read-only deals scope; minimal data retention; security page |
| Scraping legality | Public pages only; respect robots/ToS; no fake accounts |
| Solo-founder bandwidth; RecoverFlow split | One company for 90 days (PRD's own rule) |

## Sources (accessed 6 Oct 2026)

- [PricingSaaS home](https://www.pricingsaas.com/) · [PricingSaaS pricing](https://www.pricingsaas.com/pricing)
- [SaaS PricePulse](https://www.saaspricepulse.com/) · [GetPricePulse tracker](https://www.getpricepulse.com/pricing-tracker.html)
- [Firecrawl Monitoring docs](https://docs.firecrawl.dev/features/monitoring) · [Firecrawl releases (v2.11)](https://github.com/firecrawl/firecrawl/releases) · [Firecrawl pricing](https://www.firecrawl.dev/pricing)
- [SaaSHero: best CI tools 2026](https://www.saashero.net/competitor/best-competitive-intelligence-tools-2026/) · [Autobound: 15 CI tools 2026](https://www.autobound.ai/blog/top-15-competitive-intelligence-tools-2026)
- [Slack rate limits for non-Marketplace apps](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/)
- Audit sources: see [FIELD_AUDIT_2026-10.md](FIELD_AUDIT_2026-10.md#sources-accessed-5-oct-2026)
