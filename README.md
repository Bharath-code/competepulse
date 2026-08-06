# CompetePulse

Slack-native competitive change agent — CI without a CI team.

## Docs

- [Product Requirements (PRD)](docs/PRD.md)
- [Product Roadmap](docs/PRODUCT_ROADMAP.md)

## Status

Phase 1 eng complete for **E0–E5** except **E4-1 Stripe** (payments deferred). Caps are enforced in code without checkout. Thin dashboard at `/dashboard`. Discovery / Phase 0 GTM items remain open in `docs/`.

## Monorepo layout

pnpm workspace (`packages/*`):

| Package                | Description                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@competepulse/core`   | Domain types + the materiality diff classifier (`diffPricing`) and the eval harness.                        |
| `@competepulse/worker` | Cloudflare Worker (Hono): watchlist CRUD, crawl/diff, Slack `/compete`, weekday digests, HITL battlecards.  |
| `@competepulse/agent`  | Eve agent tools, `/compete` parser, digest schedule helpers, skills, `instructions.md`, Slack app manifest. |

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
```

No secrets are required for local development: when `FIRECRAWL_API_KEY` is
unset, the crawl pipeline uses deterministic mock fixtures. Slack signature
checks are skipped when `SLACK_SIGNING_SECRET` is unset.

### Secrets hygiene (E0-2)

| File                                | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `.env.example`                      | Root template for app/integration env vars (copy → `.env`) |
| `packages/worker/.dev.vars.example` | Wrangler local secrets template (copy → `.dev.vars`)       |

Never commit `.env`, `.env.*` (except `.env.example`), or `.dev.vars`.
`.vercel/` and `.netlify/` are gitignored. CI runs `pnpm secrets:check` to
reject tracked secret files and common leak patterns.

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

D1 schema lives in `packages/worker/migrations/` (`0001_init.sql` + `0002_phase1.sql`).
Local tests use the in-memory store that mirrors that schema; R2/Queues bindings
are declared in `packages/worker/wrangler.jsonc`.
