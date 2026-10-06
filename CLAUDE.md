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
- **Leads:** `docs/data/` (gitignored, personal data). `leads-2026-10.csv` = 66 HubSpot-tagged dev-tools SaaS from treg/CompanyEnrich; 11 tier-A rows have a named contact + LinkedIn (1 email: Botpress); no other emails yet. "HubSpot on site" ≠ HubSpot CRM, so confirm it on the call.
- **Revenue and company vision:** [one-pager](https://claude.ai/artifact/MvQE5Z77r6UhyFbxZgMqNY): bootstrap-first; scenarios assume ~$250/mo blended (modest ~$6K MRR at month 12, strong ~~$15K); pure-alerts niche likely caps at $0.5–2M ARR; raise only if deal-outcome data becomes a moat (~~$30K MRR checkpoint). Figures are assumptions, not data.
- **Explainers:** [pivot in plain words](https://claude.ai/artifact/97iX8iHMc8QS7caFgtCmeS) · [HubSpot deal match feasibility](https://claude.ai/artifact/Q9tUeWB2fWd7NMRrt6wfYA).
- **Founder GTM guide:** [The Quiet Founder's Field Guide](https://claude.ai/artifact/4ztJn6Gbt2NZUCESuBtzko) (interactive artifact): pipeline calculator, 25-min call trainer, closing ladder, 12-week skills tracker, reading shelf. Its funnel rates are placeholder assumptions until real send/accept/call numbers exist. No local source file; update it by republishing to that URL.
- **Outreach (Notion, CompetePulse GTM):** Leads DB (tier-A contacts filled: 11 named, 13 with LinkedIn search links) and the "Outreach messages: first 11 named leads" page (connection notes + follow-ups).
- Claude reports and scratch output go to `.claudedocs/`; project docs go to `docs/`.

## Landing (`packages/landing`)

@DESIGN.md

- Visual system: [DESIGN.md](DESIGN.md) (Superhuman-inspired, adapted at the top of the file). Design doc and copy deck: [docs/LANDING_DESIGN.md](docs/LANDING_DESIGN.md).

- Copy lives only in `src/copy.ts` (mirrors the copy deck in `docs/LANDING_DESIGN.md`); `test/copy.test.ts` guards the promises.
- Sections: Hero (signature GSAP scene) → Problem (scrubbed week) → Product (native radio tabs) → Compare → Pricing → Founder → FAQ → teal close with Calendly.
- Motion lives in one lazy chunk, `src/scripts/motion.ts`. The entry `landing.ts` loads it at idle on ≥64rem, or when the product steps near the viewport; never under reduced motion or Save-Data. Server HTML always shows each scene's finished frame.
- Styles: `src/styles/landing.css` (tokens + mock-ups) and scoped component styles. `global.css` is only for `/interview`. `BaseLayout` imports no CSS.
- Fonts: Bricolage Grotesque and Source Sans 3 **variable** (weights 460/540); only the display face is preloaded. Run `pnpm --filter @competepulse/landing fonts` after changing faces.
- Budgets (enforced in `test/build.test.ts`): entry JS < 4KB, HTML < 18KB gz, lazy JS < 60KB gz. Lighthouse mobile is 100/100/100/100 as of v2; keep it there.
- CSP is `script-src 'self'`: no CDNs, no inline scripts.
- Last self-score against Awwwards criteria: 8.3/10 (`.claudedocs/landing-awwwards-score-2026-10-06-v2.md`).

## Build status (as of 6 Oct 2026)

- **E0 security: done** (G0 closed, PR #10, branch protection on). All 9 audit blockers fixed: mock-complete gated to `ENVIRONMENT=local`, fail-closed secrets, per-workspace encrypted tokens, signed OAuth `state`, Slack `team.id` checks, fixtures local-only, CI green. `app.ts` split into `routes/*`.
- **E1 Firecrawl v2 monitors: done and deployed** (PR #12, #13; migrations 0004–0007 applied remotely). Worker: https://competepulse-worker.kumarbharath63.workers.dev
- **E2 concierge kit** (PR #14) and **E12 PostHog funnel events + landing beacon** (PR #15): merged.
- **Landing deployed:** https://competepulse-landing.kumarbharath63.workers.dev
- **Still blocked on secrets before a partner can use prod:** `FIRECRAWL_API_KEY`, `PUBLIC_WORKER_URL`, `DASHBOARD_ACCESS_TOKEN`, `TOKEN_ENCRYPTION_KEY`, Slack app creds, `POSTHOG_API_KEY`, `PUBLIC_POSTHOG_KEY`. Worker redeploy pending after E12.
- **Next:** 🔒 epics wait for G1 (day 21). Until then the work is discovery calls, not code.

## Working rules

- Fail closed on missing secrets unless `ENVIRONMENT=local`.
- Never store fixture data as a real snapshot.
- Scrape markdown (1 credit), hash, extract JSON only on change.
- PRD §11-12 describes a stack never built (Eve, Stripe, Next, Vectorize); the code is the source of truth.
- Firecrawl research output goes to `.firecrawl/` (gitignored).
