# Improved prompt (6 Oct 2026)

Original: "use treg to find leads… only hubspot or similar… detailed rewrite plan with acceptance criteria… sprint planner… landing page best in class threejs/gsap, pictures, motion graphics, no AI slop… score on Awwwards criteria… improve this prompt and use it."

---

You are founder-side PM, growth operator and design engineer for CompetePulse (see CLAUDE.md, docs/STRATEGY.md). Deliver three things, in this order, each verifiable.

## 1. Lead list (treg)

- **ICP filter (all must hold):** B2B SaaS · 20–200 employees · CRM = HubSpot (or Pipedrive / Close / Attio / Salesforce Essentials as a second tier, tagged) · Slack-using · AI or devtools category preferred · has a public pricing page.
- **Signals, ranked:** HubSpot detected on site (tech stack) → hiring PMM / sales / RevOps in last 30 days → raised in last 90 days → recent competitor pricing change.
- **Contacts:** founder/CEO (≤50 people), Head of Marketing / PMM / RevOps / Head of Sales (50–200). Work email via routed finder with `X-Treg-Route-Max-Cost: 0.05`.
- **Process:** catalog search → catalog get (price, hit rate) → one small test call → scale. Report total spend. Hard cap: stop and ask before spending > $10.
- **Output:** `docs/data/leads-2026-10.csv` (gitignored, contains personal data) with columns matching `docs/OUTREACH.md` + `crm`, `signal`, `why_now`, `source_url`. State coverage plainly (N companies, M with contacts, K emails). Note EU/UK lawful-basis rule.

## 2. Rewrite plan (sprint planner)

- `docs/REWRITE_PLAN.md`. Grounded in current code (what to keep / change / delete, with file paths), not the PRD's never-built stack.
- Sections per feature (epic): Security hardening · Firecrawl v2 + Monitor · Onboarding (domain → map → watchlist → dossier) · HubSpot connect + competitor mapping · Deal match + owner→Slack DM · Response drafts + approve · Win/loss + scoreboard · Billing/plans · Analytics · Landing.
- Each epic: goal, user story, tasks as `- [ ]` checkboxes, **testable acceptance criteria** (Given/When/Then or measurable), dependencies, estimate (days), owner.
- Sprints of 1 week mapped to the 90-day gates (day 21 / 45 / 90). Gate-blocked work is marked "do not start until gate X passes". Definition of Done. Risks.

## 3. Landing page (packages/landing, Astro)

- Positioning from the pivot: deal-aware competitive response, HubSpot + Slack, "tells the rep whose deal it hits, with proof and a talk track".
- Craft bar: Awwwards SOTD level. Motion with GSAP + ScrollTrigger; one Three.js hero scene that means something (rival signal → deals), not decoration. Real "pictures": crisp product composites (Slack DM, HubSpot deal card, screenshot diff) built in code, no stock or AI-generated imagery.
- Constraints: Lighthouse perf ≥ 90 on mobile, LCP < 2.5s, `prefers-reduced-motion` fully respected, WCAG AA contrast, keyboard focus, works without JS (content readable), lazy-load Three.js.
- Keep existing tests/build green (`pnpm --filter @competepulse/landing build test typecheck`).
- Self-score honestly against Awwwards criteria (Design 40%, Usability 30%, Creativity 20%, Content 10%) with evidence, before and after. Score from screenshots, not from intent.
- Follow user's frontend rules: existing design system first; name any outside reference used and what changed; ask before installing missing tools.
