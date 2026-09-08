# Concierge ops — Path A3

Manual weekday digests for design partners. **Do not** rely on Worker `MemoryStore` across deploys — cold starts wipe data. Use this doc + a sheet as system of record; use the Worker only as assistive tooling.

## Daily checklist (Mon–Fri)

1. Open partner watchlist sheet (columns below).
2. For each URL: open page (or run local crawl with `FIRECRAWL_API_KEY`).
3. Compare to yesterday’s notes / content hash.
4. Classify with [MATERIALITY_RUBRIC_V0.md](./MATERIALITY_RUBRIC_V0.md).
5. Draft Slack message (template below).
6. Post to partner `#competitive` (or named channel) by their morning.
7. Log delivery date + reaction/open signal.

## Watchlist sheet columns

| partner | competitor | url | label | last_hash | last_checked | last_materiality | last_summary | citation |

`label`: `pricing` | `changelog` | `docs` | `careers` | `other`

## Slack digest template

```text
*CompetePulse digest — YYYY-MM-DD*

*CompetitorName*
• `[high|low]` Summary of what changed — <https://citation.example/path>
  _Why it matters: one line._

*OtherCompetitor*
• All quiet (watch ran).
```

Rules:

- Every change line **must** include a citation URL.
- Quiet competitors still get a line so the partner knows the watch ran.
- Never invent a change you did not verify on the live page.

## Assistive Worker usage (optional)

```bash
pnpm --filter @competepulse/core build
pnpm eval                          # keep precision gate green
pnpm --filter @competepulse/worker dev
# POST /watches + crawl with fixture or FIRECRAWL_API_KEY
# Copy formatted body from POST /digests/run — then paste to Slack yourself
```

Treat outputs as drafts. Founder posts the final message.

## Acceptance criteria

- [ ] ≥10 digests delivered across partners over ≥2 weeks
- [ ] ≥70% open/read signal (reaction, reply, or written confirmation)
- [ ] Every change line includes a citation URL
- [ ] Rubric v0 maintained with ≥15 labeled examples
- [ ] Written go/no-go at end of concierge window ([GO_NO_GO.md](./GO_NO_GO.md))

## Status

| Item | Owner | Status |
|------|-------|--------|
| Ops checklist + template | Eng | Ready |
| Partner digests ≥10 | Founder | Pending |
| Open-rate tracking | Founder | Pending |
