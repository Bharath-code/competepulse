# CompetePulse

Slack-native competitive change agent — CI without a CI team.

## Docs

- [Product Requirements (PRD)](docs/PRD.md)
- [Product Roadmap](docs/PRODUCT_ROADMAP.md)

## Status

Phase 1 eng complete for **E0–E5**, including **E4-1 Dodo Payments** (Starter $149 / Pro $399). Thin dashboard at `/dashboard` with upgrade buttons. Discovery / Phase 0 GTM items remain open in `docs/`.

## Monorepo layout

pnpm workspace (`packages/*`):

| Package                 | Description                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@competepulse/core`    | Domain types + the materiality diff classifier (`diffPricing`) and the eval harness.                        |
| `@competepulse/worker`  | Cloudflare Worker (Hono): watchlist, crawl/diff, Slack, digests, HITL battlecards, dashboard, Dodo billing. |
| `@competepulse/agent`   | Eve agent tools, `/compete` parser, digest schedule helpers, skills, `instructions.md`, Slack app manifest. |
| `@competepulse/landing` | Static Astro marketing page + Calendly booking (P0-3). See [its README](packages/landing/README.md).        |

## Requirements

- Node.js 22 (see `.nvmrc`)
- pnpm 10 (`corepack enable`)

## Getting started

```bash
corepack enable
pnpm install
pnpm --filter @competepulse/core build
pnpm --filter @competepulse/agent build
pnpm dev                                  # worker on http://localhost:8787
pnpm dev:landing                          # landing page on http://localhost:4321
```

No secrets are required for local development: when `FIRECRAWL_API_KEY` is
unset, the crawl pipeline uses deterministic mock fixtures. Slack signature
checks are skipped when `SLACK_SIGNING_SECRET` is unset. Dodo checkout uses a
local mock activator when `DODO_PAYMENTS_API_KEY` is unset.

### Secrets hygiene (E0-2)

| File                                | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `.env.example`                      | Root template for app/integration env vars (copy → `.env`) |
| `packages/worker/.dev.vars.example` | Wrangler local secrets template (copy → `.dev.vars`)       |

Never commit `.env`, `.env.*` (except `.env.example`), or `.dev.vars`.
`.vercel/` and `.netlify/` are gitignored. CI runs `pnpm secrets:check` to
reject tracked secret files and common leak patterns.

## Billing — Dodo Payments (E4-1)

CompetePulse uses [Dodo Payments](https://dodopayments.com) (Merchant of Record)
for India + international subscriptions instead of Stripe.

1. Create **Starter** ($149/mo) and **Pro** ($399/mo) subscription products in the Dodo dashboard.
2. Set `DODO_PAYMENTS_API_KEY`, `DODO_PRODUCT_STARTER`, `DODO_PRODUCT_PRO` in `.dev.vars` / CF secrets.
3. Add a webhook endpoint → `https://<worker>/billing/webhooks/dodo` for:
   `subscription.active`, `subscription.renewed`, `subscription.plan_changed`,
   `subscription.on_hold`, `subscription.paused`, `subscription.cancelled`,
   `subscription.expired`, `subscription.failed`.
4. Set `DODO_PAYMENTS_WEBHOOK_KEY` from the endpoint Overview tab.

Local without keys:

```bash
# create a workspace, then mock-checkout to Pro
curl -s -XPOST localhost:8787/workspaces -H 'content-type: application/json' \
  -d '{"slackTeamId":"T_LOCAL","plan":"trial"}'
curl -s -XPOST localhost:8787/billing/checkout -H 'content-type: application/json' \
  -d '{"workspaceId":"<id>","plan":"pro"}'
# open the returned checkoutUrl (or GET it) to activate the plan
```

## Landing page + Calendly (P0-3)

The outbound landing page lives in [`packages/landing`](packages/landing) — a static
Astro build whose single call-to-action books a 15-minute discovery call.

```bash
pnpm dev:landing                              # http://localhost:4321

# production build (Calendly link is validated at build time)
PUBLIC_SITE_URL=https://competepulse.com \
PUBLIC_CALENDLY_URL=https://calendly.com/<user>/15min \
  pnpm --filter @competepulse/landing build

pnpm --filter @competepulse/landing deploy    # Cloudflare assets-only Worker
```

Config template: [`packages/landing/.env.example`](packages/landing/.env.example).
With `PUBLIC_CALENDLY_URL` unset the page still ships: every call-to-action falls
back to a `mailto:` link instead of a dead button.

## Slack install (E1-2)

1. Create a Slack app from [`packages/agent/slack-app-manifest.json`](packages/agent/slack-app-manifest.json).
2. Replace `YOUR_WORKER_HOST` with your Worker URL (or a tunnel to `localhost:8787`).
3. Install the app to a test workspace and invite the bot to `#competitive`.
4. Set `SLACK_SIGNING_SECRET` / `SLACK_BOT_TOKEN` in `.dev.vars` (or CF secrets).

Slash commands:

```text
/compete watch add <url> [label]
/compete watch list
/compete watch remove <id>
```

## Common commands

| Command              | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `pnpm install`       | Install workspace dependencies                    |
| `pnpm build`         | Build all packages                                |
| `pnpm typecheck`     | Type-check all packages                           |
| `pnpm test`          | Run all unit tests (Vitest)                       |
| `pnpm lint`          | Lint with ESLint                                  |
| `pnpm format`        | Check formatting with Prettier                    |
| `pnpm eval`          | Run the materiality eval dry-run + precision gate |
| `pnpm secrets:check` | Fail if tracked env/secret files or leak patterns |
| `pnpm dev`           | Start the Worker locally (`wrangler dev`)         |
| `pnpm dev:landing`   | Start the landing page locally (`astro dev`)      |

## Try the crawl + Slack surface

With the worker running (`pnpm dev`):

```bash
# open the thin dashboard (E4-2 / E4-3)
open http://localhost:8787/dashboard

# add a watch (HTTP)
curl -s -XPOST localhost:8787/watches \
  -H 'content-type: application/json' \
  -d '{"competitor":"Acme","url":"https://acme.example/pricing","label":"pricing"}'

# baseline crawl (materiality: none), then a changed crawl (materiality: high)
curl -s -XPOST localhost:8787/watches/<id>/crawl -d '{"fixture":"acme_v1"}'
curl -s -XPOST localhost:8787/watches/<id>/crawl -d '{"fixture":"acme_v2"}'

# thin scrape → Browser Run fallback (E2-5)
curl -s -XPOST localhost:8787/watches/<id>/crawl -d '{"fixture":"thin_page"}'

# grounded Q&A (E3-3)
curl -s -XPOST localhost:8787/qa \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"<ws>","question":"Did Acme change price?"}'

# simulate /compete watch list
curl -s -XPOST localhost:8787/slack/commands \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'team_id=T_LOCAL&channel_id=C1&user_id=U1&command=/compete&text=watch+list'

# run weekday digest (idempotent per workspace/day; Block Kit + quiet mode)
curl -s -XPOST localhost:8787/digests/run \
  -H 'content-type: application/json' \
  -d '{"now":"2026-08-06T13:00:00Z"}'

# founder cost meter (E5-3)
curl -s localhost:8787/workspaces/<ws>/usage
```

D1 schema lives in `packages/worker/migrations/` (`0001_init.sql`,
`0002_phase1.sql`, `0003_billing.sql`). Local tests use the in-memory store that
mirrors that schema; R2/Queues bindings are declared in
`packages/worker/wrangler.jsonc`.
