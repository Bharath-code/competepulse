# Worker deploy runbook — Path B6

Bring up a production/staging CompetePulse Worker in under two hours.

## 1. Cloudflare resources

```bash
# From packages/worker
pnpm exec wrangler d1 create competepulse          # if new; update database_id in wrangler.jsonc
pnpm exec wrangler r2 bucket create competepulse-snapshots
pnpm exec wrangler queues create competepulse-crawl
```

Apply migrations:

```bash
pnpm --filter @competepulse/worker db:migrate:remote
```

## 2. Secrets

```bash
pnpm exec wrangler secret put FIRECRAWL_API_KEY
pnpm exec wrangler secret put SLACK_SIGNING_SECRET
pnpm exec wrangler secret put SLACK_BOT_TOKEN          # fallback; prefer per-workspace OAuth token
pnpm exec wrangler secret put SLACK_CLIENT_ID
pnpm exec wrangler secret put SLACK_CLIENT_SECRET
pnpm exec wrangler secret put DODO_PAYMENTS_API_KEY
pnpm exec wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY
pnpm exec wrangler secret put DODO_PRODUCT_STARTER
pnpm exec wrangler secret put DODO_PRODUCT_PRO
pnpm exec wrangler secret put DASHBOARD_ACCESS_TOKEN  # required before public traffic
pnpm exec wrangler secret put FOUNDER_ALERT_WEBHOOK   # Slack incoming webhook for digest failures
```

Wrangler vars (non-secret) in dashboard or `wrangler.jsonc`:

- `DODO_PAYMENTS_ENVIRONMENT=live_mode` (or `test_mode` for staging)
- `ALLOW_BROWSER_FIXTURES=0`
- `PUBLIC_WORKER_URL=https://api.competepulse.com`

## 3. Deploy

```bash
pnpm --filter @competepulse/core build
pnpm --filter @competepulse/agent build
pnpm --filter @competepulse/worker deploy
```

Attach custom domain to the Worker (e.g. `api.competepulse.com`).

## 4. Slack app

1. Create app from [`packages/agent/slack-app-manifest.json`](../packages/agent/slack-app-manifest.json).
2. Replace `YOUR_WORKER_HOST` with `api.competepulse.com`.
3. Enable OAuth redirect `https://api.competepulse.com/slack/oauth/callback`.
4. Install via `https://api.competepulse.com/slack/install`.

## 5. Dodo webhook

Endpoint: `https://api.competepulse.com/billing/webhooks/dodo`  
Events: `subscription.active`, `renewed`, `plan_changed`, `on_hold`, `paused`, `cancelled`, `expired`, `failed`.

## 6. Staging proof (24h)

- [ ] Create trial workspace; add 1 watch; crawl succeeds; R2 object present
- [ ] Set digest channel; `POST /digests/run` posts to Slack once
- [ ] Second digest same UTC day is skipped (idempotent)
- [ ] Cron at 13:00 UTC fires without error in Worker logs
- [ ] Kill `SLACK_BOT_TOKEN` temporarily → founder alert webhook receives failure text
- [ ] With `DASHBOARD_ACCESS_TOKEN` set, unauthenticated `/dashboard` returns 401

## 7. Acceptance

- Fresh env brought up from this doc in &lt;2 hours
- Staging survives 24h with cron enabled and at least one test digest
- Founder alert on digest Slack failure after crawl success
