# CompetePulse — Execution Roadmap

**Product:** Slack-native competitive change agent  
**PRD:** [PRD.md](./PRD.md)  
**Status:** Phase 1 — MVP eng complete (Stripe deferred)  
**Last updated:** 2026-08-06

---

## Phase 0: Discovery & Concierge (Weeks 1–4)

**Goal:** 3 design partners; prove digests are loved before full automation.

**Status:** 0/8 tasks complete | **Current Phase:** Phase 0 (GTM / discovery still open)

### Week 1–2: Learn & Outreach

- [ ] **P0-1** Build ICP list of 100 PMM / Enablement contacts
- [ ] **P0-2** Complete 10 discovery calls (script in PRD Appendix C)
- [ ] **P0-3** Landing page + Calendly live
- [ ] **P0-4** Register domain + Slack app stub

### Week 3–4: Design Partners & Gate

- [ ] **P0-5** Secure 3 design partner agreements
- [ ] **P0-6** Deliver concierge digests for 2 weeks (≥10 digests; ≥70% open)
- [ ] **P0-7** Write materiality rubric v0 (15 labeled examples)
- [ ] **P0-8** Go/no-go: all-in CompetePulse vs pause for RecoverFlow

**Exit criteria:**
- [ ] 3 design partners committed
- [ ] Qualitative “must keep” signal from ≥2 partners
- [ ] Written 90-day product focus decision

---

## Phase 1: MVP (Weeks 5–10)

**Goal:** Automated Slack digests; 5 paid pilots; eval precision ≥85%.

**Status:** Eng epics E0–E5 done except **E4-1 Stripe** (payments deferred)

### Epic E0: Project Setup

- [x] **E0-1** Scaffold `competepulse/` (Eve agent + Cloudflare worker)
- [x] **E0-2** Env templates + secrets hygiene
- [x] **E0-3** CI: lint, unit tests, eval dry-run

### Epic E1: Eve Agent + Slack

- [x] **E1-1** `instructions.md` + skills (`material_change`, `saas_pricing_schema`, `digest_voice`)
- [x] **E1-2** Slack channel install on test workspace
- [x] **E1-3** `/compete watch add|list|remove` → D1
- [x] **E1-4** Weekday digest schedule (idempotent)
- [x] **E1-5** HITL approve/reject battlecard snippet

### Epic E2: Crawl Pipeline

- [x] **E2-1** Cloudflare Queue consumer + retries
- [x] **E2-2** Firecrawl scrape + pricing/changelog schemas
- [x] **E2-3** R2 snapshot versions + content hash
- [x] **E2-4** Diff + materiality classifier
- [x] **E2-5** Browser Run fallback on thin scrape
- [x] **E2-6** Plan caps enforced in code

### Epic E3: Digest + Q&A

- [x] **E3-1** Slack digest formatter (cited blocks)
- [x] **E3-2** Quiet / all-quiet mode
- [x] **E3-3** Thread Q&A grounded in snapshots
- [x] **E3-4** `draft_battlecard` tool (HITL required to publish)

### Epic E4: Billing + Dashboard

- [ ] **E4-1** Stripe Starter $149 / Pro $399 + webhooks *(deferred — choose payments later)*
- [x] **E4-2** Dashboard watchlist UI
- [x] **E4-3** Change history + snapshot links

### Epic E5: Quality Gates

- [x] **E5-1** Eval fixture set (20 pages)
- [x] **E5-2** Precision ≥85% gate in CI
- [x] **E5-3** Per-workspace cost meter

**Phase 1 exit criteria:**
- [ ] 5 paying or paid pilots *(blocked on E4-1 / GTM)*
- [x] Digests fully automated for partners *(eng path: cron + queue + formatter)*
- [x] Eval materiality precision ≥85%
- [ ] Estimated gross margin ≥70% at plan caps *(needs live crawl spend after pilots)*

---

## Phase 2: Growth Loop (Weeks 11–20)

**Goal:** Compounding channel; ~$4k+ MRR; annual + referrals.

- [ ] **P2-1** In-Slack referral flow + tracking
- [ ] **P2-2** Annual billing (2 months free); push mix ≥30% new logos
- [ ] **P2-3** Vectorize semantic diff (FP ↓ ≥30%)
- [ ] **P2-4** Careers/jobs extract schema
- [ ] **P2-5** Weekly public teardown posts (8 weeks)
- [ ] **P2-6** Friday WoW MRR scoreboard ritual
- [ ] **P2-7** Churn interview on every cancel

**Exit criteria:**
- [ ] ≥$4k MRR
- [ ] Referral k-factor measured
- [ ] Monthly logo churn ≤4% or annual mix rising

---

## Phase 3: Expand (Weeks 21–40)

**Goal:** Double winning channel; one expansion surface; hire gate.

- [ ] **P3-1** Document + 2× winning acquisition channel
- [ ] **P3-2** Ship Teams **or** CRM hook (≥5 workspaces)
- [ ] **P3-3** One enablement partner rev-share pilot
- [ ] **P3-4** Pro upsell at 80% URL cap (≥15% convert)
- [ ] **P3-5** Open part-time GTM role if ≥$12k MRR + ≥75% margin

**Exit criteria:**
- [ ] ≥$9k MRR (stress path) or better
- [ ] Written channel playbook

---

## Phase 4: Moat (Weeks 41–52)

**Goal:** History UX; vertical pack; NRR ≥110%; seed/YC-ready narrative.

- [ ] **P4-1** 90-day competitor change report UX
- [ ] **P4-2** “SaaS CI” vertical pack marketed
- [ ] **P4-3** Trailing 90-day NRR ≥110%
- [ ] **P4-4** Traction narrative (MRR, precision, logos, NRR)

---

## North-star reminder

| Mode | Target |
|------|--------|
| Bootstrap / solo | Plan for ~$9k MRR by M12 |
| Base upside | ~$15–20k MRR by M12 |
| YC-pace | 5–7% WoW MRR after ~$1k MRR |

**Precision and churn beat crawl volume.** Do not scale Firecrawl/Browser spend until eval gates pass.
