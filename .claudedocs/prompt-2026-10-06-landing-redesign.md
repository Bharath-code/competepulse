# Improved prompt: landing redesign (6 Oct 2026)

Original: "rewrite the complete redesign of the landing page, award-winning design with design doc, GSAP, motion graphics, best copywriting, highly converting. Score on Awwwards criteria. Best UI/UX/frontend, performant. Improve this prompt and use it."

---

Act as design director, conversion copywriter and frontend engineer for CompetePulse (`packages/landing`, Astro, static, CSP `script-src 'self'`). Replace the current page with a ground-up redesign. Follow this order and show evidence at each step.

## 0. Inputs (read first)

- Positioning: `docs/STRATEGY.md`. ICP: HubSpot + Slack B2B SaaS, 20–200 people, PMM or founder-led sales. One job: **book a discovery call** (secondary: see the product).
- User frontend rules (`~/.claude/CLAUDE.md`): pick a DESIGN.md from refero / VoltAgent awesome-design-md, put it at the repo root and `@import` it from CLAUDE.md. Motion reference from kinetics.colorion.co. Name every outside reference and what it changed. If a page can't be read, stop and ask.

## 1. Design doc first: `docs/LANDING_DESIGN.md`

- Concept and visual thesis in one paragraph; why it fits this buyer.
- Tokens: color (4–6 hex, light and dark if used), type scale, spacing, radius, motion (durations, easings, stagger).
- IA: section list with the job of each section and the objection it answers.
- Copy deck: every headline, subhead and CTA, written for the ICP. Specific, no hype, no invented customers or numbers.
- Motion spec: one signature moment, what each animation explains, triggers, reduced-motion fallback.
- Conversion plan: CTA placement, risk reversal, pricing transparency, honest proof (no fake logos or testimonials).
- Acceptance criteria (below).

## 2. Build

- GSAP (+ ScrollTrigger) for motion graphics: SVG/DOM motion that explains the product (rival change → matched deals → DM → outcome). No decorative fade-up on every section.
- Product visuals built in code (no stock, no AI images); real-looking but labelled as examples.
- Keep: Calendly booking + mailto fallback, JSON-LD, OG, `/interview` page, self-hosted fonts, no cookies or trackers.

## 3. Acceptance criteria

- Lighthouse mobile: perf ≥ 95, a11y ≥ 98, BP 100, SEO 100. LCP < 2.0s, CLS < 0.05, TBT < 100ms.
- Entry JS ≤ 4KB; lazy motion chunk ≤ 60KB gz; HTML ≤ 18KB gz.
- Works with JS off and under `prefers-reduced-motion` (everything readable, nothing hidden).
- WCAG AA contrast, visible focus, keyboard reachable CTAs, `lang`, landmarks.
- No horizontal scroll at 360px; layout checked at 360 / 768 / 1440.
- Tests updated and green; lint, typecheck and Prettier clean.

## 4. Score

- Score before (current page) and after on Awwwards criteria (Design 40 · Usability 30 · Creativity 20 · Content 10), from screenshots and Lighthouse numbers, with the gap to Site of the Day listed honestly.
