# CompetePulse

> **When a competitor moves, CompetePulse tells the reps whose deals it touches,
> with proof and a talk track.**

Deal-aware competitive intelligence for B2B SaaS teams of 20–200 people that run
on HubSpot and Slack.

- Landing: https://competepulse-landing.kumarbharath63.workers.dev
- Worker API: https://competepulse-worker.kumarbharath63.workers.dev

## The pitch

### Problem

A rival raises its price on Tuesday. On Wednesday your buyer says "Rival is $30
cheaper per seat now." The rep is the last to know.

- **Alert tools** (Visualping, Unkover, Firecrawl Monitor) ping a channel nobody
  reads, and they don't know which deals are at stake.
- **Enterprise CI** (Klue, Crayon) does tie changes to deals, but costs
  $20–40k a year and needs a full-time owner. A 50-person company has neither.

Every tool under $5k a year answers *"what did competitors change?"* Only $20k+
tools answer _"which of my deals does this hit, and what do my reps say?"_
CompetePulse sits in that gap.

### How it works

```text
Competitor page changes
  → Firecrawl monitor sends field-level JSON diff  → Worker webhook
  → materiality classifier: high / low / none      (noise is dropped)
  → match open HubSpot deals that name this rival  🔒 E5
  → DM each deal owner in Slack: deal, proof, a line to use
  → PMM approves or edits the response once         🔒 E7
  → every affected rep gets it; outcome is tracked  🔒 E10
```

### Who it's for

B2B SaaS, 20–200 employees, HubSpot CRM, Slack-first, with a 1–2 person PMM team
or founder-led sales. We start with AI and devtools, where rivals change pricing
monthly: in Q2 2026 one in five SaaS companies changed AI pricing (PricingSaaS).
This ICP is an assumption that the discovery calls are testing.

### Why we win

| vs                             | Their angle                   | Ours                                                     |
| ------------------------------ | ----------------------------- | -------------------------------------------------------- |
| Visualping, Unkover, Firecrawl | Alert a channel               | Alert the **deal owner**, with the deal named            |
| Klue, Crayon ($20–40k/yr)      | Deal intel for enterprise     | Same outcome, self-serve in 10 minutes, ~10× cheaper     |
| PricingSaaS Pulse ($25/mo)     | Pricing research for analysts | Action for sellers; complementary, so a possible partner |

**What compounds over time:**

1. **Private context:** HubSpot deals joined to public changes. A scraper can't
   copy what it can't see.
2. **Response library:** approved talk tracks build up in our system and are
   lost if a customer leaves.
3. **Outcome data:** win rate per rival before and after each move, which can
   later become anonymized cross-customer benchmarks.
4. **Trust:** a published precision number on real pages, and every alert cites
   its source.

**Build vs buy:** we buy fetch, diff and judging from Firecrawl. We own snapshot
history (R2), customer context, responses and outcomes.

### Business model

Unseated pricing: the value metric is rivals tracked plus CRM, not seats.

| Plan           | Price                        | Includes                                                                 |
| -------------- | ---------------------------- | ------------------------------------------------------------------------ |
| Free           | $0                           | 2 rivals, weekly Slack digest, dossier                                   |
| Starter        | $99/mo                       | 5 rivals, daily alerts, screenshots, search signals                      |
| Team           | $299/mo                      | 15 rivals, **HubSpot deal-aware alerts**, response drafts, MCP, win/loss |
| Business       | $699+/mo                     | Unlimited rivals, regional pricing, API                                  |
| Design partner | $49/mo, locked for 12 months | 2 weeks run by hand, then weekly feedback and a case study               |

- **Unit economics (assumed, not measured yet):** a Starter workspace costs about
  $1.50/mo in Firecrawl credits plus ~$3 in LLM, so gross margin should be above
  95%. Two Starter customers cover infrastructure.
- **Revenue scenarios (assumed):** ~$250/mo blended price; month 12 lands at
  ~$6K MRR in the modest case and ~$15K in the strong case. The plan is to
  bootstrap and raise only if outcome data becomes a moat.
- ⚠️ The code still bills the older Starter $149 / Pro $399
  (`packages/core/src/plans.ts`). Epic E6 moves billing to the prices above,
  which are the ones on the landing page.

### Traction and gates

Honest status: **the engine is built; there are 0 users, 0 calls and $0 MRR.**
Proving the market is now the bottleneck, not code.

- **Pipeline:** 66 HubSpot-tagged devtools SaaS leads, 11 tier-A contacts with
  outreach started.
- **North star:** deals touched by an approved response per week.
- **Kill criteria:**
  - Day 21: fewer than 5 of 20 calls rank deal-level response in their top 3 pains.
  - Day 45: fewer than 3 paying design partners.
  - Day 90: under $750 MRR or under 1.5% free→paid.

## Features

### Built

| Feature                  | What it does                                                                                                                         | Epic |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| Competitor watches       | Track pricing / changelog URLs per rival; plan caps enforced                                                                         | E1   |
| Firecrawl v2 monitors    | One shared daily monitor per URL across tenants, JSON change tracking, webhook in; cron reconciles monitors                          | E1   |
| Materiality classifier   | Labels each diff high / low / none (price, plan, enterprise-feature gates vs minor features, trial length)                           | core |
| Snapshot history         | Every snapshot stored in R2, linked from alerts as proof                                                                             | E1   |
| Slack app                | OAuth install, `/compete watch add/list/remove`, signed requests, interactions                                                       | E0   |
| Weekday digest           | Block Kit digest per workspace, idempotent per day, quiet mode when nothing changed                                                  | core |
| Grounded Q&A             | Answers "did Acme change price?" only from stored changes, always with citations; refuses when nothing supports an answer            | E3-3 |
| Battlecard drafts + HITL | Draft → approve / reject / publish to Slack (becomes `responses` in E7)                                                              | core |
| Billing                  | Dodo Payments checkout + subscription webhooks (Merchant of Record for India + international)                                        | E4-1 |
| Cost meter               | Per-workspace crawl / browser usage and estimated cost                                                                               | E5-3 |
| Funnel analytics         | PostHog: `install → alert_delivered → response_approved → paid`, plus a cookieless landing beacon                                    | E12  |
| Security                 | Fails closed on missing secrets, per-workspace encrypted tokens, signed OAuth `state`, Slack `team.id` checks, secret scanning in CI | E0   |
| Concierge kit            | Tooling to run the loop by hand for design partners                                                                                  | E2   |
| Landing + `/interview`   | Astro site, Calendly booking, Lighthouse 100 across all four categories on mobile and desktop                                        | E13  |

### Planned (🔒 each waits for its gate: G1 day 21, G2 day 45, G3 day 90)

| Epic | Feature                   | Acceptance bar                                                                                                 |
| ---- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| E4   | HubSpot connect           | OAuth in under 2 min, read-only deal scopes, auto-suggests the competitor field, token never logged            |
| E3   | Onboarding                | Domain → auto-found pricing/changelog/docs URLs (≥8/10 correct) → dossier posted in p50 ≤ 60s                  |
| E5   | Deal match + owner DM     | Material change → DM to each open-deal owner within 5 min, no duplicates, max 1 DM per deal per rival per week |
| E6   | Plans + billing           | Free / $99 / $299 / $699 / $49 partner; HubSpot gated to Team+                                                 |
| E7   | Response drafts + approve | Cited LLM draft ≤120 words with one "say this" line; approved once, sent to every affected owner               |
| E8   | Displacement signals      | Search monitors for launches, funding and complaints (G2/Reddit/HN); ≥14 of 20 signals judged relevant         |
| E9   | Trust: real-page eval     | 100 real labelled change pairs, ≥90% precision, published on a `/trust` page                                   |
| E10  | Win/loss scoreboard       | Deal outcomes joined to responses; win rates shown only when n ≥ 20 per arm                                    |
| E11  | MCP + marketplaces        | Read-only MCP (`rival_changes`, `responses_for`, `deals_touched`); Slack and HubSpot marketplace listings      |

## Evals, AI and quality metrics

### Where AI is used today

| Step                   | How                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Page → structured data | **LLM extraction via Firecrawl** (`changeTracking` JSON mode with a per-page schema, `src/monitor.ts`) |
| "Is this material?"    | **Deterministic rules** (`diffPricing`), on purpose: auditable, and no false alarms from LLM drift     |
| Q&A                    | Retrieval over stored changes only; refuses rather than invent facts                                   |
| Response drafts        | Not built yet. LLM drafts with mandatory citations arrive in E7                                        |

Our own code makes no direct LLM calls yet. `llm_tokens` is already a usage
metric type, so model spend will show in the cost meter when E7 lands.

### Materiality eval (`pnpm eval`)

Last run 17 Oct 2026:

| Metric                | Result | CI gate |
| --------------------- | ------ | ------- |
| Cases                 | 20     | —       |
| Accuracy              | 100%   | —       |
| Precision (on `high`) | 100%   | ≥ 85%   |
| Recall (on `high`)    | 100%   | —       |

Label mix: 13 high, 5 low, 2 none, across 5 fictional vendors. They cover price
hikes and cuts, plans added and removed, SSO / SAML / SCIM / HIPAA / audit-log
gates, trial-length changes and cosmetic features.

**Read this number carefully:** the 20 cases are hand-written synthetic
fixtures (`packages/core/src/eval/fixtures.ts`), built alongside the rules they
test, so 100% shows the rubric is implemented correctly, not that it works on
real pages. A real-page number comes from E9: 100 labelled pairs from partner
data, a ≥90% precision target, and CI failing if it drops more than 3 points.
The [rubric](docs/MATERIALITY_RUBRIC_V0.md) sets the policy: prefer missed
changes over false alarms.

### Test suite (`pnpm test`)

158 tests, all passing: worker 90, landing 43, agent 14, core 11.

### Product metrics (targets, not yet measured)

| Metric                                       | Target     | Source                                |
| -------------------------------------------- | ---------- | ------------------------------------- |
| Deals touched by an approved response / week | North star | `response_approved` → `deals_touched` |
| Alert precision on real pages                | ≥ 90%      | E9 eval                               |
| Time to first alert                          | < 24 h     | `install` → `alert_delivered`         |
| Alerts that get an action                    | ≥ 60%      | Slack button clicks                   |
| Dossier latency                              | p50 ≤ 60 s | E3                                    |
| Free → paid                                  | ≥ 2%       | `paid` event                          |

### Landing performance

Lighthouse 100/100/100/100 on mobile and desktop (live URL, 12 Oct 2026). Build
tests enforce: entry JS < 4 KB, HTML < 18 KB gzipped, lazy JS < 60 KB gzipped.

## Engineering status

| Epic                               | State                      |
| ---------------------------------- | -------------------------- |
| E0 security hardening              | Done (PR #10)              |
| E1 Firecrawl v2 monitors           | Done, deployed (#12, #13)  |
| E2 concierge kit                   | Merged (#14)               |
| E12 PostHog funnel events + beacon | Merged (#15)               |
| Landing + `/interview`             | Deployed (#17, #19)        |
| E3–E11 (🔒 gated G1+)              | Waiting on discovery calls |

Production still needs secrets before a design partner can use it (see
[Production secrets](#production-secrets)).

## Docs

**Strategy and plan**

- [Strategy](docs/STRATEGY.md): wedge, ICP, kill criteria
- [Rewrite plan](docs/REWRITE_PLAN.md): 13 weekly sprints, epics E0–E13, gates G1–G3
- [Field audit (Oct 2026)](docs/FIELD_AUDIT_2026-10.md)
- [Go / no-go](docs/GO_NO_GO.md)
- [PRD](docs/PRD.md) and [roadmap](docs/PRODUCT_ROADMAP.md). PRD §11–12 describe a stack that was never built; the code is the source of truth.

**Go-to-market**

- [Discovery calls](docs/DISCOVERY_CALLS.md) · [Outreach / ICP](docs/OUTREACH.md) · [Concierge ops](docs/CONCIERGE_OPS.md) · [Pilot exit checklist](docs/PILOTS_B7.md)

**Product and ops**

- [Materiality rubric v0](docs/MATERIALITY_RUBRIC_V0.md) · [Analytics](docs/ANALYTICS.md) · [Landing design + copy deck](docs/LANDING_DESIGN.md)
- [Worker deploy runbook](docs/RUNBOOK_DEPLOY.md) · [Go-live checklist](docs/GO_LIVE_CHECKLIST.md)

## Monorepo layout

pnpm workspace (`packages/*`):

| Package                 | Description                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@competepulse/core`    | Domain types, the materiality diff classifier (`diffPricing`), and the eval harness.                                                                                      |
| `@competepulse/worker`  | Cloudflare Worker (Hono) with D1, R2 and Queues: watches, Firecrawl monitor webhook, Slack, digests, battlecards, dashboard, Dodo billing. Routes live in `src/routes/*`. |
| `@competepulse/agent`   | `/compete` slash parser, digest schedule helpers, agent tools, skills (`skills/*.md`), `instructions.md`, Slack app manifest.                                             |
| `@competepulse/landing` | Astro marketing site + Calendly booking, plus the `/interview` brief. See [its README](packages/landing/README.md).                                                       |

## Requirements

- Node.js 22 (`.nvmrc`)
- pnpm 10 (`corepack enable`)

## Getting started

```bash
corepack enable
pnpm install
pnpm --filter @competepulse/core build
pnpm --filter @competepulse/agent build
cp packages/worker/.dev.vars.example packages/worker/.dev.vars   # keeps ENVIRONMENT=local
pnpm dev                                  # worker on http://localhost:8787
pnpm dev:landing                          # landing on http://localhost:4321
```

The worker **fails closed** on missing secrets unless `ENVIRONMENT=local`. In
local mode no secrets are needed:

- No `FIRECRAWL_API_KEY` → crawls use deterministic mock fixtures.
- No `SLACK_SIGNING_SECRET` → Slack signature checks are skipped.
- No `DODO_PAYMENTS_API_KEY` → checkout uses a local mock activator (`/billing/mock-complete`).
- No `TOKEN_ENCRYPTION_KEY` → Slack tokens are stored unencrypted.

Outside `ENVIRONMENT=local`, fixtures and mock checkout are disabled and
mutating routes return 503 until their secrets are set.

## Common commands

| Command              | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `pnpm build`         | Build all packages                                    |
| `pnpm typecheck`     | Type-check all packages                               |
| `pnpm test`          | Run all unit tests (Vitest)                           |
| `pnpm lint`          | Lint with ESLint                                      |
| `pnpm format`        | Check formatting with Prettier (`format:write` fixes) |
| `pnpm eval`          | Run the materiality eval dry-run + precision gate     |
| `pnpm secrets:check` | Fail on tracked env/secret files or leak patterns     |
| `pnpm dev`           | Start the Worker locally (`wrangler dev`)             |
| `pnpm dev:landing`   | Start the landing page locally (`astro dev`)          |

Worker-specific: `pnpm --filter @competepulse/worker db:migrate:local | db:migrate:remote | deploy`.

## Try it locally

With `pnpm dev` running:

```bash
open http://localhost:8787/dashboard

# add a watch
curl -s -XPOST localhost:8787/watches -H 'content-type: application/json' \
  -d '{"competitor":"Acme","url":"https://acme.example/pricing","label":"pricing"}'

# baseline crawl (materiality: none), then a changed crawl (materiality: high)
curl -s -XPOST localhost:8787/watches/<id>/crawl -d '{"fixture":"acme_v1"}'
curl -s -XPOST localhost:8787/watches/<id>/crawl -d '{"fixture":"acme_v2"}'

# thin scrape → browser fallback
curl -s -XPOST localhost:8787/watches/<id>/crawl -d '{"fixture":"thin_page"}'

# grounded Q&A
curl -s -XPOST localhost:8787/qa -H 'content-type: application/json' \
  -d '{"workspaceId":"<ws>","question":"Did Acme change price?"}'

# simulate /compete watch list
curl -s -XPOST localhost:8787/slack/commands \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'team_id=T_LOCAL&channel_id=C1&user_id=U1&command=/compete&text=watch+list'

# weekday digest (idempotent per workspace/day)
curl -s -XPOST localhost:8787/digests/run -H 'content-type: application/json' \
  -d '{"now":"2026-08-06T13:00:00Z"}'

# cost meter
curl -s localhost:8787/workspaces/<ws>/usage
```

## Firecrawl monitors (E1)

Production crawling is monitor-driven: one Firecrawl v2 monitor per URL (shared
across tenants, daily, JSON change tracking) calls `POST /monitor/webhook`.
Firecrawl does not sign monitor webhooks, so the monitor sends a shared secret
as `Authorization: Bearer`, compared in constant time.

The weekday cron (`0 13 * * 1-5`) reconciles monitors (backfills missing,
deletes unwatched) and posts digests; it does not crawl. `POST /watches` returns
503 in production until `FIRECRAWL_API_KEY`, `FIRECRAWL_WEBHOOK_SECRET` and
`PUBLIC_WORKER_URL` are set.

## Slack install

1. Create a Slack app from [`packages/agent/slack-app-manifest.json`](packages/agent/slack-app-manifest.json).
2. Replace `YOUR_WORKER_HOST` with your Worker URL (or a tunnel to `localhost:8787`).
3. Set `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`. Bot tokens are per workspace, stored encrypted by the OAuth install (`/slack/install`, signed `state`, `team.id` checked).
4. Invite the bot to `#competitive`.

```text
/compete watch add <url> [label]
/compete watch list
/compete watch remove <id>
```

## Billing (Dodo Payments)

[Dodo Payments](https://dodopayments.com) is the Merchant of Record (India +
international), not Stripe.

1. Create **Starter** ($149/mo) and **Pro** ($399/mo) subscription products in Dodo.
2. Set `DODO_PAYMENTS_API_KEY`, `DODO_PRODUCT_STARTER`, `DODO_PRODUCT_PRO`.
3. Point a webhook at `https://<worker>/billing/webhooks/dodo` for the
   `subscription.*` events (`active`, `renewed`, `plan_changed`, `on_hold`,
   `paused`, `cancelled`, `expired`, `failed`), then set `DODO_PAYMENTS_WEBHOOK_KEY`.

Local mock checkout:

```bash
curl -s -XPOST localhost:8787/workspaces -H 'content-type: application/json' \
  -d '{"slackTeamId":"T_LOCAL","plan":"trial"}'
curl -s -XPOST localhost:8787/billing/checkout -H 'content-type: application/json' \
  -d '{"workspaceId":"<id>","plan":"pro"}'
# open the returned checkoutUrl to activate the plan
```

## Landing

Static Astro build on a Cloudflare assets-only Worker. Details, budgets and
motion rules: [`packages/landing/README.md`](packages/landing/README.md).

```bash
PUBLIC_SITE_URL=https://competepulse.com \
PUBLIC_CALENDLY_URL=https://calendly.com/<user>/15min \
  pnpm --filter @competepulse/landing ship
```

With `PUBLIC_CALENDLY_URL` unset, every call-to-action falls back to `mailto:`.
Copy lives only in `src/copy.ts`; CSP is `script-src 'self'`.

## Production secrets

Templates: `.env.example` (root) and `packages/worker/.dev.vars.example`. Set
production values with `wrangler secret put <NAME>`.

| Secret                                                     | Needed for                                  |
| ---------------------------------------------------------- | ------------------------------------------- |
| `FIRECRAWL_API_KEY`, `FIRECRAWL_WEBHOOK_SECRET`            | Monitors + webhook auth                     |
| `PUBLIC_WORKER_URL`                                        | Monitor webhook target, OAuth redirect      |
| `DASHBOARD_ACCESS_TOKEN`                                   | `/dashboard` and mutating APIs              |
| `TOKEN_ENCRYPTION_KEY`                                     | Per-workspace Slack token encryption        |
| `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID/SECRET`           | Slash commands, interactions, OAuth install |
| `DODO_PAYMENTS_*`, `DODO_PRODUCT_*`                        | Billing                                     |
| `POSTHOG_API_KEY` (worker), `PUBLIC_POSTHOG_KEY` (landing) | Funnel events                               |

Never commit `.env`, `.env.*` (except `.env.example`) or `.dev.vars`. CI runs
`pnpm secrets:check`.

## Data

D1 schema: `packages/worker/migrations/` (`0001_init` → `0007_monitors_label`).
Tests use an in-memory store that mirrors it. Snapshot history lives in R2;
bindings are in `packages/worker/wrangler.jsonc`. Fixture data is never stored
as a real snapshot.
