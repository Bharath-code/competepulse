# CompetePulse

Slack-native competitive intelligence for mid-market B2B SaaS. A competitor
changes something → CompetePulse finds the open HubSpot deals it touches →
drafts a cited talk track → a human approves it in Slack.

- Landing: https://competepulse-landing.kumarbharath63.workers.dev
- Worker: https://competepulse-worker.kumarbharath63.workers.dev

## Status (Oct 2026)

Engine built, no customers yet. Market proof is the current bottleneck, not code.

| Epic                                    | State                      |
| --------------------------------------- | -------------------------- |
| E0 security hardening                   | Done (PR #10)              |
| E1 Firecrawl v2 monitors                | Done, deployed (#12, #13)  |
| E2 concierge kit                        | Merged (#14)               |
| E12 PostHog funnel events + beacon      | Merged (#15)               |
| Landing + `/interview`                  | Deployed (#17, #19)        |
| Deal matching, responses (🔒 gated G1+) | Waiting on discovery calls |

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
