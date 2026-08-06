# CompetePulse

Slack-native competitive change agent — CI without a CI team.

## Docs

- [Product Requirements (PRD)](docs/PRD.md)
- [Product Roadmap](docs/PRODUCT_ROADMAP.md)

## Status

Phase 1 — project setup (roadmap **E0-1…E0-3**). Discovery docs remain in `docs/`.

## Monorepo layout

pnpm workspace (`packages/*`):

| Package                | Description                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@competepulse/core`   | Domain types + the materiality diff classifier (`diffPricing`) and the eval harness.                                            |
| `@competepulse/worker` | Cloudflare Worker (Hono) crawl/diff API: watchlist CRUD, `/crawl`, `/diff`, `/health`. Runs locally with Wrangler.              |
| `@competepulse/agent`  | Eve agent tools (`watch_add`, `crawl_now`, `get_changes`, `draft_battlecard`), digest formatter, skills, and `instructions.md`. |

## Requirements

- Node.js 22 (see `.nvmrc`)
- pnpm 10 (`corepack enable`)

## Getting started

```bash
corepack enable
pnpm install
pnpm --filter @competepulse/core build   # build shared package
pnpm dev                                  # run the worker on http://localhost:8787
```

No secrets are required for local development: when `FIRECRAWL_API_KEY` is
unset, the crawl pipeline uses deterministic mock fixtures.

### Secrets hygiene (E0-2)

| File                                | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `.env.example`                      | Root template for app/integration env vars (copy → `.env`) |
| `packages/worker/.dev.vars.example` | Wrangler local secrets template (copy → `.dev.vars`)       |

Never commit `.env`, `.env.*` (except `.env.example`), or `.dev.vars`.
`.vercel/` and `.netlify/` are gitignored. CI runs `pnpm secrets:check` to
reject tracked secret files and common leak patterns.

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

## Try the crawl pipeline

With the worker running (`pnpm dev`):

```bash
# add a watch
curl -s -XPOST localhost:8787/watches \
  -H 'content-type: application/json' \
  -d '{"competitor":"Acme","url":"https://acme.example/pricing","label":"pricing"}'

# baseline crawl (materiality: none), then a changed crawl (materiality: high)
curl -s -XPOST localhost:8787/watches/<id>/crawl -d '{"fixture":"acme_v1"}'
curl -s -XPOST localhost:8787/watches/<id>/crawl -d '{"fixture":"acme_v2"}'
```
