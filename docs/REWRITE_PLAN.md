# Rewrite plan: deal-aware competitive response

**Owner:** founder (solo) · **Window:** 6 Oct 2026 → 4 Jan 2027 (90 days) · **Sprint length:** 1 week, Mon–Sun
**Inputs:** [STRATEGY.md](STRATEGY.md) · [FIELD_AUDIT_2026-10.md](FIELD_AUDIT_2026-10.md) · [DISCOVERY_CALLS.md](DISCOVERY_CALLS.md) · [HubSpot deal match explainer](https://claude.ai/artifact/Q9tUeWB2fWd7NMRrt6wfYA)

This is a **targeted rewrite**: keep the engine, replace the plumbing, add the deal layer. The code is the source of truth. The PRD §11–12 stack (Eve, Stripe, Next, Vectorize) is not part of this plan.

---

## 0. Ground rules

- **Capacity:** about **3.5 build days a week**. The rest goes to calls, outreach and concierge. Estimates below are in build days.
- **Gates decide scope.** Work marked 🔒 does not start until its gate passes. A failed gate triggers the fallback in STRATEGY §9, not a push-through.
- **One epic in progress at a time**, except Landing (E13), which runs alongside.
- **Every task ships behind a test.** No PR merges with CI red.

| Gate | Date | Pass condition | If it fails |
| --- | --- | --- | --- |
| G0 | Sun 11 Oct (day 5) | E0 done: all 9 audit blockers closed, CI green, branch protection on | No partner touches prod |
| **G1** | **Tue 27 Oct (day 21)** | ≥5/20 calls rank "rival move hits live deals" top-3, **and** the median competitor-field fill rate passes the rule in DISCOVERY_CALLS.md | Stop E4–E11. Fall back to Option C/E |
| **G2** | **Fri 20 Nov (day 45)** | ≥3 paying design partners ($49/mo) | Stop building, re-interview |
| G2.5 | Sun 13 Dec (day 68) | ≥60% of deal alerts get an action (approve / forward / dismiss) | Fix relevance before adding features |
| **G3** | **Mon 4 Jan (day 90)** | ≥$750 MRR (stretch $1.5k), ≥1 case study with a deal outcome, free→paid ≥1.5% | Stop GTM spend |

## 1. Keep / change / delete (current code)

| Area | File(s) | Decision | Why |
| --- | --- | --- | --- |
| Materiality + pricing diff | `core/src/materiality.ts`, `schemas.ts`, `changelog.ts` | **Keep**; becomes the schema layer on top of Firecrawl JSON diffs | Already tested, with an eval harness |
| Plans | `core/src/plans.ts` | **Change**: trial/starter/pro → free/starter/team/business + partner | Pricing in STRATEGY §6 |
| Scrape | `worker/src/scrape.ts` (Firecrawl **v1**), `browser.ts` | **Change**: v2 + Monitor; fixtures for tests only | Audit #2; buy fetch/diff/judge |
| Crawl fan-out | `crawl.ts`, `queue.ts`, cron in `index.ts` | **Change**: Monitor webhook → queue → `change_events`; cron only for digests and the nightly sweep | Fixes the digest race (audit #6) |
| Storage | `d1-store.ts`, `store.ts`, `r2.ts`, `migrations/` | **Keep + extend** (migrations 0005–0008) | R2 history is something we own |
| HTTP app | `app.ts` (889 lines, ~35 routes) | **Split** into `routes/{slack,hubspot,watches,billing,monitor,deals}.ts` | Too big to review; makes the security fixes easier |
| Slack | `slack.ts`, `slack-api.ts`, `digest-deliver.ts` | **Keep + extend**: DMs, scopes, block kit | DM to the deal owner is the product |
| Battle cards | `battlecard_drafts`, `agent/src/tools.ts` | **Repurpose** as `responses` (talk tracks tied to a deal) | The approve flow already exists |
| Billing | `billing/dodo.ts` | **Keep, fix** fail-open and `/billing/mock-complete` | Audit #1, #3 |
| Web dashboard | `dashboard.ts` | **Freeze** at settings only | Cut list |
| Agent | `agent/src/slash.ts`, `qa.ts` | **Keep**; add `/compete deals`, `/compete map` | |

---

## 2. Sprint calendar

| Sprint | Dates | Focus | Epics | Build days |
| --- | --- | --- | --- | --- |
| S1 | 6–11 Oct | Make it safe | E0, E13 (start) | 3.5 |
| S2 | 12–18 Oct | Buy the eyes | E1, E2, E13 | 3.5 |
| S3 | 19–25 Oct | Concierge + landing ship | E2, E13, E12 | 3.5 |
| — | **Tue 27 Oct** | **G1** | | |
| S4 | 26 Oct–1 Nov | 🔒 Connect HubSpot | E4, E3 (start) | 3.5 |
| S5 | 2–8 Nov | 🔒 Onboarding + mapping | E3, E4 | 3.5 |
| S6 | 9–15 Nov | 🔒 Deal match → DM | E5, E6 | 3.5 |
| S7 | 16–22 Nov | 🔒 Partner hardening | E5 polish | 3.5 |
| — | **Fri 20 Nov** | **G2** | | |
| S8 | 23–29 Nov | 🔒 Responses | E7 | 3.5 |
| S9 | 30 Nov–6 Dec | 🔒 Responses + signals | E7, E8 | 3.5 |
| S10 | 7–13 Dec | 🔒 Trust | E9 | 3.5 |
| S11 | 14–20 Dec | 🔒 Win/loss | E10 | 3.5 |
| S12 | 21–27 Dec | 🔒 Scoreboard + MCP | E10, E11 | 2.5 (holidays) |
| S13 | 28 Dec–4 Jan | 🔒 Marketplaces + case study | E11 | 2.5 |
| — | **Mon 4 Jan** | **G3** | | |

---

## 3. Epics

Format for each epic: goal, user story, tasks (`[ ]` with an estimate in days), acceptance criteria (AC), dependencies.

### E0 · Security & CI — S1 · 3.5d · gate G0

**Goal:** nothing a design partner touches can leak, fake data or grant free access.
**Story:** As a partner, I trust that my Slack and HubSpot tokens can't be read by anyone else.

- [x] Delete `GET /billing/mock-complete` outside `ENVIRONMENT=local` (`app.ts:701-727`) — 0.25d
- [x] Fail closed on missing secrets: `slack.ts:15`, `billing/dodo.ts:333`, `access.ts:33` — 0.5d
- [x] Remove `?access_token=`; constant-time compare; per-workspace tokens instead of the global admin token (`access.ts:21,34`) — 0.75d
- [x] `GET /workspaces` never returns bot tokens; encrypt tokens at rest (AES-GCM, key in a secret) (`workspace-store.ts:43`) — 0.5d
- [x] OAuth `state` (signed, 10-minute TTL) on Slack install (`app.ts:136-177`) — 0.25d
- [x] Check Slack interactions against `payload.team.id`; delete the global token fallback (`app.ts:628,542`, `digest-deliver.ts:60`) — 0.5d
- [ ] Fixtures never reach prod storage: `thin` → error and retry, never Acme (`scrape.ts:149-155`, `browser.ts:37`) — 0.25d
- [ ] CI green (ESLint `app.ts:90`, Prettier); branch protection on `main` — 0.25d
- [ ] Split `app.ts` into `routes/*` (no behavior change, tests stay green) — 0.25d (mechanical)

**AC**
- Given `SLACK_SIGNING_SECRET` is unset and `ENVIRONMENT≠local`, when `/slack/commands` is called, then it returns 503 and logs `secret_missing`.
- `GET /billing/mock-complete` returns 404 in production (test asserts this).
- A request with `?access_token=` is rejected (401) even when the token is valid.
- `GET /workspaces` response JSON contains no field that matches `/xox[bp]-/` (test).
- A Slack interaction whose `team.id` doesn't match the workspace returns 403 (test).
- A thin scrape writes **zero** rows to `snapshots` and `change_events` (test).
- CI passes on `main`; a direct push to `main` is refused.

### E1 · Firecrawl v2 + Monitor — S2 · 3d · depends on E0

**Goal:** stop running our own crawler. Firecrawl watches, diffs and judges; we store and interpret.
**Story:** As a partner, I get a change alert within hours of a rival's edit, without us polling every page ourselves.

- [ ] Provider interface `MonitorProvider { create, delete, list }` + Firecrawl implementation (v2 API) — 0.75d
- [ ] `POST /monitor/webhook`: verify signature, dedupe on event id (reuse `processed_webhooks`), enqueue — 0.5d
- [ ] Queue consumer: event → R2 snapshot → `diffPricing` / changelog → `change_events` with materiality — 0.75d
- [ ] JSON change tracking with schemas from `core/src/schemas.ts`; `goal` prompt per page type — 0.5d
- [ ] Screenshot (before/after) stored in R2 and linked in the event — 0.25d
- [ ] Remove the polling crawl path; keep the cron for digests only — 0.25d
- [ ] Migration `0005_monitors.sql` (`monitors`, `monitor_events`) — included above

**AC**
- Given a watch is created, when the workspace adds a URL, then exactly one Firecrawl monitor exists for that URL across all tenants (shared fetch).
- Given a replayed webhook (same id), then exactly one `change_event` is stored.
- Given an unsigned or badly signed webhook, then 401 and nothing is stored.
- A digest run never includes an event whose snapshot hasn't been written (fixes audit #6; test).
- Cost per workspace is visible in `usage_ledger`; a 30-URL daily watch costs ≤ 1.5k credits a month (log check over 7 days).

### E2 · Concierge kit — S2–S3 · 1.5d

**Goal:** run the full loop by hand for 5 prospects **before** building HubSpot code.
**Story:** As the founder, I can turn a partner's deal CSV plus a real rival change into ready-to-send DMs in under 10 minutes.

- [ ] `scripts/concierge-match.ts`: input `deals.csv` (name, owner_email, stage, amount, competitor) + `change_event` id → markdown DMs grouped by owner — 0.75d
- [ ] Talk-track prompt v0 (cites the change, one paragraph, one line to say) — 0.5d
- [ ] Log every concierge alert to `docs/data/concierge-log.csv` (gitignored): deal, sent, reply, outcome — 0.25d

**AC**
- Given a 50-row CSV with 6 deals against Rival, then the script outputs 6 DMs grouped by owner, each with the change summary, a screenshot link and one suggested line.
- Deals in closed stages are excluded.
- ≥5 prospects receive at least 1 concierge alert by 25 Oct.

### E12 · Analytics — S3 · 1d

- [ ] PostHog (server-side events from the Worker; landing page view + CTA)
- [ ] Funnel: `install → first_alert → first_approved_response → paid`
- [ ] North-star query: deals touched by an approved response, per week

**AC:** each funnel event fires once per occurrence (test with mocked client); the dashboard shows the north star by week.

### E4 · 🔒 HubSpot connect + competitor mapping — S4–S5 · 4d · after G1

**Goal:** read deals safely and know which field means "competitor".
**Story:** As an admin, I connect HubSpot in under 2 minutes and tell CompetePulse which field lists competitors.

- [ ] HubSpot app (developer platform 2025.2 project), OAuth with `state`, scopes `crm.objects.deals.read crm.objects.owners.read crm.schemas.deals.read` — 1d
- [ ] `hubspot_connections` (encrypted refresh token, portal id); token refresh with retry — 0.5d
- [ ] Field discovery: list deal properties, suggest likely ones (`/compet/i`), Slack modal to pick one (option A) — 1d
- [ ] Option B: create a "Competitors" multi-select (needs `crm.schemas.deals.write`, asked only when picked) — 0.5d
- [ ] `competitor_map`: our rival id ↔ their option value(s); auto-match by name, admin confirms — 0.5d
- [ ] Pipelines cache: which stage ids are closed — 0.25d
- [ ] Settings page lists the connection, mapped field and unmapped rivals — 0.25d

**AC**
- Given a HubSpot test portal, when the admin finishes OAuth, then a `hubspot_connections` row exists with an encrypted token and the portal id; the plaintext token never appears in logs or API responses.
- An expired access token refreshes automatically; a revoked token marks the connection `needs_reauth` and DMs the admin once.
- Given a portal with a "Primary Competitor" dropdown, then it's suggested first.
- Given the admin chooses B, then the property exists in HubSpot with our rivals as options.
- OAuth without a valid `state` returns 400.

### E3 · 🔒 Onboarding: domain → watchlist → dossier — S4–S5 · 3d

**Goal:** value in the first session, before any change happens.
**Story:** As a new user, I type my rivals' domains and see their pricing, changelog and recent moves within 60 seconds.

- [ ] `firecrawl map --search` per domain → pick pricing / changelog / docs / blog / status URLs — 1d
- [ ] Create monitors for the chosen URLs (E1) — 0.25d
- [ ] Dossier: plans, positioning, last 90 days of changes (scrape JSON + search news) → Slack message — 1.25d
- [ ] `/compete add <domain>` and the install-flow prompt — 0.5d

**AC**
- Given `linear.app`, then ≥3 correct URL types are found (checked against a hand-labelled set of 10 domains: ≥8/10 correct).
- Time from `/compete add` to dossier posted: p50 ≤ 60s, p95 ≤ 120s.
- Plan caps are enforced: Free 2 rivals, Starter 5, Team 15.

### E5 · 🔒 Deal match + owner DM — S6–S7 · 4.5d

**Goal:** the core loop. A rival change reaches the right seller about the right deal.
**Story:** As a rep, when a rival on my open deal changes something material, I get a DM naming my deal, with proof and a line to use.

- [ ] Matcher: material `change_event` → workspaces watching that rival → HubSpot search (competitor CONTAINS_TOKEN, stage NOT_IN closed) → paginate — 1d
- [ ] Owner → email (owners API) → Slack user (`users.lookupByEmail`); add Slack scopes `users:read.email im:write`; `rep_map` overrides — 0.75d
- [ ] DM block kit: deal name + amount, change summary, screenshot, draft line, buttons [Use it] [Edit] [Not relevant] — 0.75d
- [ ] Throttle: max 1 DM per deal per rival per 7 days; skip deals below the workspace's min amount or stage — 0.5d
- [ ] Option C: weekly "who's competing on these deals?" nudge to reps for deals with an empty field → writes back (needs `crm.objects.deals.write`, opt-in) — 1d
- [ ] `deal_alerts` table (deal, change, owner, sent_at, action, action_at) — 0.25d
- [ ] Unmatched owners listed in settings — 0.25d

**AC**
- Given 3 open deals naming Rival and 1 closed one, when Rival's material change lands, then exactly 3 DMs go to the 3 owners' Slack users within 5 minutes.
- Given the same change lands twice, then no duplicate DMs (idempotent on change × deal).
- Given an owner whose email has no Slack match, then no DM is sent, the deal appears in "unmatched" and the admin channel gets one summary.
- "Not relevant" clicks are stored and lower that change type's priority for that workspace.
- A DM renders correctly in Slack desktop and mobile (manual check with screenshots in the PR).
- HubSpot search calls stay ≤ 5/s per portal (rate limiter test).

### E6 · 🔒 Plans & billing — S6 · 1.5d

- [ ] `plans.ts`: free / starter $99 / team $299 / business $699 / partner $49 (locked 12 months)
- [ ] Dodo products + webhook mapping; HubSpot features gated to Team+
- [ ] Upgrade prompt in Slack when a cap is hit

**AC:** a Free workspace can't connect HubSpot (403 + upgrade message); a paid Dodo webhook flips the plan within 1 minute; the partner price can't be bought without a coupon.

### E7 · 🔒 Response drafts + approve — S8–S9 · 4d · after G2

**Goal:** turn alerts into approved, reusable talk tracks.
**Story:** As a PMM, I approve or edit a suggested response once, and every rep facing that rival gets it.

- [ ] Rename and migrate `battlecard_drafts` → `responses` (rival, change, body, citations, status, approver) — 0.5d
- [ ] Draft generator with citations (change diff + screenshot + news), ≤120 words, one "say this" line — 1d
- [ ] Approve in Slack (PMM / admin role); edit modal; versioning — 1d
- [ ] Approved response goes to all affected deal owners and is linked to `deal_alerts` — 0.75d
- [ ] Optional: log the response as a HubSpot note on the deal (write scope, opt-in) — 0.75d

**AC**
- Every draft cites ≥1 source URL that points to a stored snapshot or a search result (test).
- Only users with the approver role can approve (403 otherwise).
- Approving sends to every open matched deal owner exactly once.
- Time from change to approved response is visible per workspace (median shown in settings).

### E8 · 🔒 Displacement signals (search monitors) — S9 · 1.5d

- [ ] Firecrawl search monitors per rival: launches, funding, exec moves, complaints (G2/Reddit/HN) with a `goal` filter
- [ ] Weekly "rival customers complaining" digest for SDRs

**AC:** in a sample of 20 signals, ≥14 are judged relevant by the partner (thumbs in Slack).

### E9 · 🔒 Trust: real-page eval — S10 · 3d

- [ ] Label 100 real change pairs (from partner data) as material / not
- [ ] Run `core/src/eval/run-eval.ts` on real labels in CI
- [ ] Publish the precision number on the landing page and a `/trust` page

**AC:** precision ≥ 90% at the current threshold; CI fails if precision drops more than 3 points.

### E10 · 🔒 Win/loss + scoreboard — S11–S12 · 3.5d

**Goal:** prove which responses work, honestly.
**Story:** As a head of sales, I see how deals against each rival end, with and without an approved response.

- [ ] Webhook `deal.propertyChange` on `dealstage` (signature-verified) → `deal_outcomes` — 1d
- [ ] Nightly sweep: deals closed since yesterday (catches missed webhooks) — 0.5d
- [ ] Join outcomes to `deal_alerts` / `responses`; read `closed_won_reason`, `closed_lost_reason` — 0.5d
- [ ] Monthly Slack scoreboard per rival: deals touched, won, lost, open; with-response vs without — 1d
- [ ] Sample-size guard: show the rates only when n ≥ 20 per arm; otherwise counts only — 0.5d

**AC**
- Given a deal closes in HubSpot, then `deal_outcomes` has the row within 5 minutes (webhook) or by 06:00 UTC the next day (sweep).
- Given a webhook is dropped (simulated), then the sweep still records the outcome.
- The scoreboard never shows a win-rate percentage when n < 20 (test).

### E11 · 🔒 MCP + marketplaces — S12–S13 · 3d

- [ ] MCP server (read-only): `rival_changes`, `responses_for(rival)`, `deals_touched(week)`
- [ ] Slack Marketplace submission (also lifts the non-Marketplace rate limits)
- [ ] HubSpot Marketplace listing (removes the 25-install cap)

**AC:** Claude Desktop can answer "what did Rival change this month and what do we say?" from the MCP; both submissions are filed.

### E13 · Landing page — S1–S3 (runs alongside)

See `packages/landing`. Positioning moves from "digest" to "deal-aware response". Three.js hero, GSAP scroll story, product composites, Lighthouse mobile ≥ 90, reduced-motion support, Calendly CTA kept.

**AC:** builds and tests are green; Lighthouse mobile perf ≥ 90, a11y ≥ 95; the hero is readable with JS off; it scores ≥ 7.5/10 on the self-audit against Awwwards criteria.

---

## 4. Definition of Done (every task)

- [ ] Tests cover the AC; `pnpm -r test typecheck lint` green
- [ ] No secret, token or PII in logs or API responses
- [ ] Fails closed when config is missing (unless `ENVIRONMENT=local`)
- [ ] Migration is reversible, or a note explains why it can't be
- [ ] Slack UI change: screenshots in the PR
- [ ] Counted in PostHog if it's a funnel step
- [ ] CLAUDE.md / README updated if setup changed

## 5. Data model additions

| Migration | Tables |
| --- | --- |
| `0005_monitors.sql` | `monitors(id, url, provider_id, created_at)`, `monitor_events(id, monitor_id, payload_r2_key, received_at)` |
| `0006_hubspot.sql` | `hubspot_connections`, `competitor_map`, `pipeline_stages`, `rep_map` |
| `0007_deals.sql` | `deal_alerts`, `deal_outcomes` |
| `0008_responses.sql` | rename `battlecard_drafts` → `responses` + `citations_json`, `version` |

## 6. Risks

| Risk | Sprint | Mitigation |
| --- | --- | --- |
| Competitor field mostly empty | G1 | Measured in calls; options B/C; D only after 10 customers |
| HubSpot app review / 25-install cap | S4, S13 | Read-only scopes first; list in S13 |
| Firecrawl changes pricing or moves up-stack | S2 | Provider interface; snapshots in our R2 |
| Solo bandwidth (calls vs build) | all | 3.5 build days a week; the cut list is enforced |
| Bad alerts burn trust | S6–S10 | Throttle, "not relevant" feedback, G2.5 action rate, eval in CI |

## 7. Cut list (until 10 customers ask)

Battle card CMS · web dashboard beyond settings · Microsoft Teams · Salesforce · Q&A over full history · option D (reading notes and calls) · regional pricing · agency workspaces.
