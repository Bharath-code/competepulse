# CompetePulse

Slack-native competitive intelligence for mid-market B2B SaaS. pnpm monorepo: `core` (diff classifier + evals), `worker` (Cloudflare Worker/Hono, D1, R2, Queues, Dodo billing), `agent` (`/compete` parser, skills), `landing` (Astro). Commands and setup: [README.md](README.md).

## Strategic direction (as of 6 Oct 2026)

- **Status:** engine built, 0 users, 0 calls, $0 MRR. Market proof is the bottleneck, not code.
- **Don't build commodity layers.** Scrape/diff/AI-noise-filter/Slack alerts are sold by Firecrawl Monitor, Visualping, Unkover. SaaS pricing history is sold by PricingSaaS Pulse ($25/mo, 3,000+ pages, MCP).
- **Wedge:** deal-aware competitive response. Competitor change → which open HubSpot deals it touches → cited talk track → approve in Slack → track win/loss.
- **Beachhead ICP:** B2B SaaS, 20–200 people, HubSpot + Slack, AI/devtools categories.
- **Firecrawl rule:** buy fetch/diff/judge (Monitor, JSON change tracking, search monitors, `map` for onboarding). Own history (R2), customer context, responses, outcomes.
- **North star:** deals touched by an approved response per week.
- **Kill criteria:** day 21 <5/20 calls rank it top-3 · day 45 <3 paying · day 90 <$750 MRR.

Full plan: [docs/STRATEGY.md](docs/STRATEGY.md) — [artifact](https://claude.ai/artifact/WgZGA73YKPFKT7v3ziMK5f). Audit (5 Oct 2026, commit `21c86b7`): [docs/FIELD_AUDIT_2026-10.md](docs/FIELD_AUDIT_2026-10.md) — [artifact](https://claude.ai/artifact/L8MHW7SvP4dVJ2463uFKrU).

## Execution docs

- **Build plan:** [docs/REWRITE_PLAN.md](docs/REWRITE_PLAN.md): 13 weekly sprints (6 Oct → 4 Jan), epics E0–E13 with acceptance criteria. 🔒 work waits for its gate (G1 day 21 · G2 day 45 · G3 day 90). One epic in progress at a time; E0 security first.
- **Discovery calls:** [docs/DISCOVERY_CALLS.md](docs/DISCOVERY_CALLS.md): 25-min script; measures pain rank and the HubSpot **competitor-field fill rate** (decides options A–D for deal matching). Tracker columns in [docs/OUTREACH.md](docs/OUTREACH.md).
- **Leads:** `docs/data/` (gitignored, personal data). `leads-2026-10.csv` = 66 HubSpot-tagged dev-tools SaaS from treg/CompanyEnrich; no emails yet. "HubSpot on site" ≠ HubSpot CRM, so confirm it on the call.
- **Explainers:** [pivot in plain words](https://claude.ai/artifact/97iX8iHMc8QS7caFgtCmeS) · [HubSpot deal match feasibility](https://claude.ai/artifact/Q9tUeWB2fWd7NMRrt6wfYA).
- Claude reports and scratch output go to `.claudedocs/`; project docs go to `docs/`.

## Landing (`packages/landing`)

- Copy lives only in `src/copy.ts`; `test/copy.test.ts` guards the pivot promises.
- Hero = three.js pulse field (`src/scripts/pulse-field.ts`), with a static SVG poster that shares geometry in `src/lib/pulse.ts`. Story = GSAP sticky stage (`src/scripts/story.ts`).
- Budgets (enforced in `test/build.test.ts`): entry JS < 4KB, HTML < 16KB gz, lazy three+GSAP < 240KB gz. Three.js loads only on ≥60rem, no reduced-motion, no Save-Data.
- CSP is `script-src 'self'`: no CDNs, no inline scripts.
- Last self-score against Awwwards criteria: 7.8/10 (`.claudedocs/landing-awwwards-score-2026-10-06.md`).

## Fix before any design partner touches prod

1. `GET /billing/mock-complete` grants free Pro — `worker/src/app.ts:701-727`
2. Thin real scrapes fall back to "Acme" fixture and enter history — `worker/src/scrape.ts:149-155`, `browser.ts:37`
3. Auth fails open when secrets unset — `slack.ts:15`, `billing/dodo.ts:333`, `access.ts:33`
4. `GET /workspaces` leaks plaintext Slack bot tokens — `workspace-store.ts:43`
5. Global admin token, `?access_token=`, `===` compare — `access.ts:21,34`
6. Digest runs before queued crawls finish — `worker/src/index.ts:20-41`
7. OAuth install lacks `state` — `app.ts:136-177`
8. Slack actions not checked against `payload.team.id`; global token fallback — `app.ts:628`, `app.ts:542`, `digest-deliver.ts:60`
9. CI red: ESLint `app.ts:90` + Prettier drift; enable branch protection

## Working rules

- Fail closed on missing secrets unless `ENVIRONMENT=local`.
- Never store fixture data as a real snapshot.
- Scrape markdown (1 credit), hash, extract JSON only on change.
- PRD §11-12 describes a stack never built (Eve, Stripe, Next, Vectorize); the code is the source of truth.
- Firecrawl research output goes to `.firecrawl/` (gitignored).
