# CompetePulse Field Audit — 5 Oct 2026

Source: [claude.ai artifact](https://claude.ai/artifact/L8MHW7SvP4dVJ2463uFKrU) · audited commit `21c86b7` · tags: **[S]** = sourced, **[A]** = assumed/judgment.

> **Correction (6 Oct 2026):** this audit recommended Option B (a shared SaaS pricing index). Follow-up research found that niche is already served: PricingSaaS Pulse (3,000+ pricing pages, full history, screenshots, MCP, watchlists, digests; free tier, Pro from $25/mo), SaaS PricePulse (260+ tools, Slack/Telegram alerts) and GetPricePulse. The engineering findings below still stand. The revised direction is in [STRATEGY.md](STRATEGY.md).

## Verdict

The engine is well built, nobody is using it yet, and the market has filled up. Niche down, don't continue as-is. A generic "Slack CI digest at $149" competes with Unkover ($79–199), Rival Radar ($149–499), Visualping's free AI importance alerts, and Firecrawl's own Monitor endpoint (your scraping vendor).

## Scorecard (0–10, judgment)

| Area | Score | Area | Score |
| --- | --- | --- | --- |
| Security | 3 | Scalability | 5 |
| Data trust | 4 | Architecture | 7 |
| Perf & cost | 6 | Docs | 8 |
| Accessibility | 7 | Testing | 5 |
| Maintainability | 6 | CI / automation | 5 |
| Market proof | 1 | | |

- **Built:** 27 commits in 35 days (6 Aug → 10 Sep), ~14.8k lines, 109 passing tests.
- **Validated:** 0 design partners, discovery calls or paying workspaces. `GO_NO_GO.md` unsigned.
- **Idle:** 25 days since last commit at audit time; domain + Calendly still "Pending".
- **PRD stress plan:** 3 paying customers due by month 3 (early Nov 2026).

Checks: `pnpm test` ✓ 109/109 · `pnpm eval` ✓ · `pnpm typecheck` ✓ · `pnpm lint` ✗ · `pnpm format` ✗

## Engineering findings

| Sev | Finding | Where | Fix |
| --- | --- | --- | --- |
| Crit | **Free Pro upgrades.** `GET /billing/mock-complete` has no auth/mock guard; `?workspace_id=…&plan=pro` activates Pro in prod. | worker/src/app.ts:701-727 | 404 when `DODO_PAYMENTS_API_KEY` set; register only in local builds. |
| Crit | **Fake pricing enters real history.** Crawl never passes `allowBrowserFixtures`; a real scrape <200 chars falls back to the "Acme" fixture and is stored as a snapshot → false cited alerts next crawl. | worker/src/scrape.ts:149-155 · browser.ts:37 · app.ts:84,780 | Fixtures off when an API key is present; thin scrape = `error`, never a snapshot. |
| Crit | **Auth fails open.** Slack signatures, Dodo webhooks, dashboard token all pass when the secret is unset. | slack.ts:15 · billing/dodo.ts:333 · access.ts:33 | Fail closed unless `ENVIRONMENT=local`; `/health` non-200 on missing secrets. |
| High | **Slack bot tokens exposed.** `GET /workspaces` returns every tenant's `xoxb-` token, stored plaintext in D1. | workspace-store.ts:43 → app.ts:198-202 | Drop from DTOs; AES-GCM at rest. |
| High | **No tenant isolation.** One global token; accepted via `?access_token=`; compared with `===`. | access.ts:21,34 | Sign in with Slack (OIDC) → per-workspace session; constant-time compare; header/cookie only. |
| High | **Digests ship before crawls finish.** Cron enqueues crawls then builds digests in the same invocation → every digest reports the previous run. | worker/src/index.ts:20-41 | Two crons (crawl 11:00, digest 13:00 UTC) or a Workflow that waits for the batch. |
| High | **OAuth install has no `state`** (CSRF). | app.ts:136-177 | Signed short-lived `state` cookie. |
| High | **Slack actions cross tenants.** Battlecard buttons resolve by ID without `payload.team.id`; global `SLACK_BOT_TOKEN` fallback. | app.ts:628 · app.ts:542 · digest-deliver.ts:60 | Verify ownership; remove global fallback in multi-tenant mode. |
| High | **CI red on main.** ESLint `Function` type + Prettier drift in 13 files; no branch protection. | app.ts:90 | `pnpm format:write`, type helper, require CI on main. |
| Med | Eval gate only tests deterministic diff (20 synthetic cases, 100% by construction). | core/src/eval/fixtures.ts | Real captures + human labels, end-to-end extract+diff precision per competitor. |
| Med | "Agent" is keyword search; no LLM/Eve runtime. | agent/src/qa.ts:28-60 | Grounded LLM answer with citations, or market as alerts. |
| Med | Crawls ~5× cost needed (JSON extract every scrape). | scrape.ts:83-92 | Markdown (1 credit) → hash → extract only on change (~75–80% fewer credits [A]). |
| Med | Queue retries fatal errors; no backoff, no DLQ. | index.ts:55-57 · wrangler.jsonc | Ack fatal; `retry({delaySeconds})`; `dead_letter_queue`. |
| Med | N+1 queries, unbounded Q&A reads. | app.ts:238-244, 395-403, 455-467 | JOIN + LIMIT; 90-day grounding window. |
| Med | Unsafe URL schemes (`javascript:`) in dashboard. | dashboard.ts:207,250 · app.ts:261 | http(s) only; reject private IPs. |
| Med | Slack scopes over-ask (`*:history` unused; throttled for non-Marketplace apps since 2025). | app.ts:143 | `commands, chat:write` only. |
| Med | PRD ↔ code drift (PRD says Eve/Stripe/Next/Vectorize; code is Hono/Dodo/HTML/no Eve). | docs/PRD.md §11-12 | ADR-002 with the stack as built. |
| Low | Firecrawl v1 endpoint. | scrape.ts:83 | Provider interface; migrate to v2. |
| Low | 889-line route file; duplicated grounding; two stores without shared contract test. | app.ts:446-469 ≈ 868-888 · store.ts · d1-store.ts | Split routes; one `groundingFor()`; shared store suite. |
| Low | `/interview` prep page public on marketing domain. | landing/src/pages/interview.astro | Move off-domain or behind access. |
| Low | Thin observability; `/health` leaks tenant counts. | app.ts:117-126 | Structured logs/Sentry; credit-spend alert; boolean `/health`. |
| Good | Strict TS monorepo; 109 tests; secrets scan in CI; timing-safe Slack HMAC w/ 5-min replay window; idempotent webhooks + digests; plan caps in code; a11y-linted landing. | repo-wide | Keep. |

## C-suite decisions

- **CEO:** sign `GO_NO_GO.md` — a 90-day all-in bet with kill criteria, or call it a portfolio project and stop infra spend. RecoverFlow is still a competing priority.
- **CPO:** one job for v1; hide battlecards/Q&A until 10 customers ask. Strongest code = `diffPricing`.
- **CTO:** 2-day hardening sprint (3 crit + 6 high), then feature freeze. Next: crawl each URL once globally, fan out to subscribers.
- **CFO:** COGS ≈ $2.70/mo Starter, $10.70 Pro at Firecrawl Standard [S]; PRD budgets ≤$60 (~20× high). Risk is revenue, not margin. Charge from first design partner.
- **CMO:** "CI without a CI team / Klue at 10%" is now everyone's pitch. Crayon 2026: 48% use competitor websites; weekly+ cadence → 79% vs 41% report revenue impact [S, vendor survey].

## Competitor map (annual list price)

| Player | Price | 2025–26 move | Threat |
| --- | --- | --- | --- |
| Firecrawl Monitor | 1 credit/URL check + 1/AI judge | Scrape → diff → AI "meaningful" judge → webhook/email/Slack | Severe — vendor sells the core loop |
| Visualping | $0 / $10 / $100 mo | AI summary + IMPORTANT flag on all plans | Severe |
| Unkover | $79–199 mo | 5–10 competitors, owns "best CI tools 2026" SEO | High |
| Rival Radar | $149–499 mo | Klue/Crayon cost pages | High |
| Klue | ~$16–80k yr | Compete Agent (Mar 2026), MCP server | Medium |
| Crayon | $15–40k+ yr (Vendr median $30k) | AI importance scoring, State of CI report | Medium |
| Kompyte (Semrush) | $3–25k yr | Semrush add-on | Medium |
| PricingSaaS · SaasTrack · PricePulse | varies | SaaS pricing history DBs | High for a pricing pivot |
| Alertedly · RivalHunt · Relevance AI | startup/template | Weekly AI CI reports, Slack alerts | Noise; low barrier |

Commoditized layers: scheduled scrape+diff → AI noise filter → Slack/webhook delivery → ask-in-chat Q&A. Market size: Mordor $0.59B (2025) → $1.46B (2030); Virtue $460M → $991M. PRD's "$3B+ TAM" only holds if sales enablement is included.

## Options scored (1–5: reuse, pull, different, less crowded, speed to $)

| Option | Scores | Total |
| --- | --- | --- |
| A · Stay the course | 5·3·1·1·3 | 13 |
| B · SaaS pricing & packaging intelligence (audit pick — see correction) | 5·3·4·3·4 | 19 |
| C · PMM AI-answer monitor | 2·5·3·2·3 | 15 |
| D · Agent-native CI feed (MCP) — distribution layer for B | 4·3·3·3·4 | 17 |
| E · Portfolio piece: fix criticals, keep demo, stop GTM spend | — | — |

## Unit economics (audit)

| Line | Value | Basis |
| --- | --- | --- |
| Firecrawl cost/credit (Standard $99/100k) | $0.00099 | [S] |
| Credits per structured scrape (1 + 4 JSON) | 5 | [S] |
| Starter: 25 URLs × 21.7 weekdays × 5 credits | $2.69/mo | arithmetic |
| Pro: 100 URLs | $10.74/mo | arithmetic |
| Shared index 3,000 pages, markdown daily + extract on ~5% change | ~108k credits ≈ $99–149/mo | [A] 5% change rate |
| LLM summarization | < $20/mo | [A] |
| Gross margin at 50 customers | ~96% | [A] |

## 30 / 60 / 90 (audit)

- **Days 1–14:** fix 3 crit + 6 high; CI green; shared crawling; 100 ICP rows; book 20 calls. *Kill/re-scope if <5 of 20 rank the core job top-3.*
- **Days 15–45:** 3 paying design partners ($49–99); real-page eval set (100 labels, ≥90% precision). *Kill if <2 pay by day 45.*
- **Days 46–90:** MCP + API; Slack Marketplace; 15 paying; $1.5k MRR. *Kill/pivot if <$750 MRR or <1.5% free→paid.*

## Future bets

Agent-native distribution (MCP) · proprietary longitudinal data · evals on real labels · AI search visibility (Peec $10M ARR May 2026, Profound $1B) · programmatic SEO from own data · platform compliance (Marketplace, minimal scopes) · durable workflows + per-tenant cost metering · founder-led distribution (20 calls/week habit).

## Assumptions ledger

| Assumption | Status | Falsify by |
| --- | --- | --- |
| PMMs at small SaaS track competitor websites | [S] 48% (Crayon 2026); 65% of PMMs own CI (PMA 2025) | <5 of 20 calls rank it top-3 |
| Pricing/packaging changes matter most | [A] | Calls rank messaging/launches higher |
| Generic CI digests are commoditized | [S] | Design partner picks us over Unkover head-to-head |
| People pay $49 for pricing alerts | [A] | <2 paying by day 45 |
| PRD $3B TAM | disputed | Use $0.5–1.5B in any deck |

## Sources (accessed 5 Oct 2026)

[Firecrawl Monitor blog](https://www.firecrawl.dev/blog/competitor-monitoring-firecrawl) · [Firecrawl CI use case](https://www.firecrawl.dev/use-cases/competitive-intelligence) · [Firecrawl pricing (ScrapeGraphAI)](https://scrapegraphai.com/blog/firecrawl-pricing) · [Firecrawl pricing (eesel)](https://www.eesel.ai/blog/firecrawl-pricing) · [Visualping AI](https://visualping.io/blog/visualping-ai) · [Visualping pricing (G2)](https://www.g2.com/products/visualping/pricing) · [Unkover pricing](https://unkover.com/pricing/) · [Rival Radar](https://rivalradar.net/) · [Klue review (ZoomInfo)](https://pipeline.zoominfo.com/sales/klue-review) · [Klue Compete Agent](https://theaiagentindex.com/agents/klue) · [Klue vs Crayon (Parano)](https://parano.ai/blog/klue-vs-crayon) · [Crayon (Vendr)](https://www.vendr.com/marketplace/crayon) · [Crayon State of CI 2026](https://www.crayon.co/state-of-competitive-intelligence-2026) · [Kompyte pricing (Parano)](https://parano.ai/blog/kompyte-pricing) · [PMA State of PM 2025](https://www.productmarketingalliance.com/state-of-product-marketing-report-2025/) · [Mordor CI tools](https://www.mordorintelligence.com/industry-reports/competitive-intelligence-tools-market) · [Virtue CI software](https://virtuemarketresearch.com/report/competitive-intelligence-software-market) · [Slack rate limits](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/) · [Peec $10M ARR](https://techcrunch.com/2026/05/23/peec-one-of-berlins-rising-startups-more-than-doubled-annualized-revenue-in-months-to-10m-sources-say/) · [AI visibility tools](https://www.rankability.com/blog/best-ai-search-visibility-tracking-tools/) · [PricingSaaS index](https://pricingsaas.com/companies/) · [GetPricePulse tracker](https://www.getpricepulse.com/pricing-tracker.html) · [SaasTrack vs PricePulse](https://www.saastrack.app/blog/saastrack-vs-getpricepulse-pricing-tracker) · [Alertedly launch](https://www.einpresswire.com/article/896568281/alertedly-launches-ai-agents-for-predictive-competitive-intelligence) · [Unkover: 15 CI tools](https://unkover.com/blog/competitive-intelligence-tools/)
