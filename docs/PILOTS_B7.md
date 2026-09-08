# Phase B7 — paid pilot exit checklist

Engineering for Path B is in-repo. This checklist tracks the live pilot conversion gate.

## Automated weekday digests

- [ ] ≥1 design partner on automated digests (Worker cron + Slack post)
- [ ] 5 consecutive weekdays with **zero** founder manual posts
- [ ] Digest idempotency verified (no double-post same UTC day)

## Quality + billing

- [ ] `pnpm eval` precision ≥85% (CI green)
- [ ] Dodo `live_mode` (or staging proof) checkout → `subscription.active` → plan visible in dashboard
- [ ] Cancelled workspace cannot add watches (402)

## Docs honesty

- [x] README separates demo vs production ([README.md](../README.md))
- [x] Roadmap notes Path A/B reality ([PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md))
- [x] Deploy runbook exists ([RUNBOOK_DEPLOY.md](./RUNBOOK_DEPLOY.md))

## Status

| Item | Owner | Status |
|------|-------|--------|
| Eng automation path | Eng | Ready |
| 5-day partner proof | Founder + staging | Pending |
| Dodo live products | Founder | Pending |
