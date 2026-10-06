# Landing design doc — v2 (Oct 2026)

**Page job:** get a HubSpot + Slack B2B SaaS team (PMM, founder, head of sales; 20–200 people) to **book a 25-minute discovery call**. Everything else on the page supports that click.
**Visual system:** [DESIGN.md](../DESIGN.md) (Superhuman-inspired, with our adaptations at the top).
**Prompt:** `.claudedocs/prompt-2026-10-06-landing-redesign.md`.

## 1. Concept

**"The message that arrives before the buyer's objection."**

The product is a well-timed message, so the page reads like a calm, high-end newsletter. That's why the Superhuman reference fits. An indigo dusk hero holds one live scene: a rival's price flips, a line runs to two open deals, and a Slack DM lands on the rep's screen. The body is white, quiet and dense with specifics. The page closes on a deep-teal band with one button.

Why this fits the buyer: PMMs and founders at AI and devtools companies are surrounded by loud dark-mode SaaS pages. A slow, editorial page with one moving scene reads as confident and trustworthy, and trust matters for a tool that reads their CRM.

### Outside references used

| Reference | What it changed |
| --- | --- |
| VoltAgent awesome-design-md → Superhuman DESIGN.md | Palette (indigo `#1b1938`, violet-soft `#c9b4fa`, teal `#0e3030`, warm ink `#292827`), three-canvas rhythm (indigo hero → white body → teal close), sub-default weights 460/540, 0.96 display leading, 8px button radius, pill only in the hero, pricing card with an inverted featured tier |
| Kinetics (kinetics.colorion.co): Toast Overshoot | DM arrival easing `cubic-bezier(0.18, 1.25, 0.4, 1)` |
| Kinetics: Scramble Reveal | `$49` → `$79` glyph scramble on the rival price |
| Kinetics: Success Check | Stroke-drawn tick on "Approved" |
| Kinetics: Odometer count-up | "Deals touched" counter |

Ruled out: Intercom DESIGN.md (cream + orange is the most common generated look); Linear (near-black + single accent); three.js (130 KB gz for a scene that SVG explains more clearly).

## 2. Tokens (implemented in `packages/landing/src/styles/global.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--indigo` | `#1b1938` | Hero, nav, primary buttons, featured price |
| `--indigo-deep` | `#0e0c1f` | Hero gradient floor, pressed states |
| `--violet` | `#c9b4fa` | Hero pill CTA, signal line, matched-deal highlight |
| `--teal` / `--teal-mid` | `#0e3030` / `#155555` | Closing band, "won" outcomes |
| `--canvas` / `--canvas-soft` | `#ffffff` / `#fafaf8` | Body, alternating rows |
| `--ink` / `--ink-mute` / `--ink-faint` | `#292827` / `#73706d` / `#9a9794`* | Text (*faint only for ≥18px or decorative) |
| `--hairline` / `--hairline-dark` | `#e8e4dd` / `#3f3a52` | 1px borders |

- **Type:** Bricolage Grotesque Variable (display 540 / 460), Source Sans 3 Variable (body 460, lead 540), JetBrains Mono (inside mock-ups only). Scale: 64 / 48 / 28 / 22 / 20 / 18 / 16 / 14 / 12 px; display leading 0.96, tracking −0.02em.
- **Space:** 8px base; sections 96px (64 on mobile); closing band 128px.
- **Radius:** 8 buttons, 12 cards, 16 large panels, pill in the hero only.
- **Motion:** `--ease-out: cubic-bezier(0.16,1,0.3,1)`, `--ease-toast: cubic-bezier(0.18,1.25,0.4,1)`; durations 180 / 400 / 700ms; stagger 90ms.

## 3. Information architecture

| # | Section | Job | Objection it answers |
| --- | --- | --- | --- |
| 1 | Nav (indigo, sticky) | Brand, 3 anchors, the CTA always in reach | "Where do I book?" |
| 2 | Hero | State the outcome; show the product doing it in 6 seconds | "What is this?" |
| 3 | The Wednesday problem | Make the cost of hearing last concrete (timeline) | "Is this a real problem?" |
| 4 | Product: Watch · Match · Message · Learn | Show how it works, one step at a time | "How does it actually work?" |
| 5 | Who hears about it | Position against alert tools and enterprise CI | "Why not Visualping / Klue?" |
| 6 | Pricing | Transparent tiers plus today's partner offer | "What will it cost?" |
| 7 | Founder note | Honest proof in place of logos we don't have | "Who's behind it? Is it real?" |
| 8 | FAQ | Data access, the empty competitor field, Salesforce | "Is it safe? Will it work for us?" |
| 9 | Closing teal band + booking | One headline, Calendly inline | "Fine, when?" |
| 10 | Footer | Contact, colophon | — |

## 4. Copy deck

Voice: plain, specific, second person. No hype words, no invented metrics or customers. Example data is always labelled.

**Nav:** How it works · Pricing · FAQ · [Book a call]

**Hero**
- Pill: For HubSpot + Slack sales teams
- H1: **When a rival moves, the rep on the deal hears first.**
- Lead: CompetePulse watches your competitors' pricing, packaging and launches, finds the open HubSpot deals each change touches, and messages the deal owner in Slack with proof and a line to use.
- CTA: **Book a 25-min call**
- Under the CTA: 2 weeks free, run by hand. No install, no card.
- Scene caption: Example: Rival raises Pro to $79. Two open deals name Rival. Sam gets the message.

**Problem — "Right now, your buyer tells your rep."**
- Mon 09:12 · Rival changes its pricing page.
- Wed 14:30 · Your buyer: "Rival is $30 cheaper per seat now."
- Wed 14:31 · Your rep improvises.
- Fri · The deal slips a quarter.
- With CompetePulse · Mon 09:40 · Sam has the change, the screenshot and a line to use, two days early.
- Footnote: Illustrative week. The timings are how this usually plays out, not data from a customer.

**Product — "One change, four steps, no new dashboard."**
- Watch: *The pages that move deals.* Pricing, packaging, changelog and docs. Cosmetic edits are dropped; real changes keep a before-and-after screenshot.
- Match: *The deals it touches.* Read-only HubSpot. Only open deals that name the rival.
- Message: *The rep, not the channel.* One DM to the deal owner, with proof and a line your PMM approved.
- Learn: *What actually wins.* Outcomes are logged next to the reply. Win rates show once there are 20 closed deals; before that, counts only.

**Who hears about it — "Every tool sees the change. Only one tells the right person."**
- Page-change alerts (Visualping, Unkover) · $25–100/mo · *#competitors, muted by Thursday*
- Enterprise CI (Klue, Crayon) · $20k–40k/yr · *Your CI manager, if you have one*
- CompetePulse · $99–299/mo · *Sam, the rep on Northwind*

**Pricing — "Priced per team, not per seat."**
- Free $0: 2 rivals · weekly Slack summary · rival dossier
- Starter $99/mo: 5 rivals · daily alerts with screenshots · launch and news signals
- Team $299/mo (featured): 15 rivals · HubSpot deal matching · DMs to deal owners · approved replies · win/loss
- Business $699+/mo: unlimited rivals · regional pricing · API
- Partner banner: **Today: 5 design-partner seats.** 2 weeks free, run by hand, then $49/mo locked for 12 months. Plans above open after the program.

**Founder note:** "CompetePulse is early, and that's the offer. For two weeks I run it by hand for your team, with your real rivals and your real deals. If it doesn't earn a place in your week, you've spent 25 minutes. — Bharath, founder"

**FAQ:** what if we don't record competitors on deals · what you read from HubSpot · what counts as a material change · Salesforce · what happens after two weeks · where the data comes from.

**Close (teal):** **Find out which of your deals your rivals touched this month.** [Book a 25-min call]

## 5. Motion spec (GSAP 3 + ScrollTrigger, one lazy chunk)

| Moment | Trigger | What it explains | Reduced motion / no JS |
| --- | --- | --- | --- |
| **Signature: hero scene** (9s loop) | Page idle; pauses offscreen and on hidden tab | Price scramble $49→$79 → signal line draws to the deals card → Northwind and Kestrel highlight in turn → DM toast overshoots in → tick draws "Approved" → counter 1→2 | Static final frame (everything visible) |
| Problem timeline | Scroll-scrubbed | Hearing last: the line runs Mon→Fri, then the "With CompetePulse" row cuts in two days early | Static timeline |
| Product steps | Radio tabs (CSS, no JS needed); GSAP auto-advances with a progress bar while in view and stops on any user input | One step at a time | Tabs still work by click and arrow keys |
| Button feedback | Hover/press | Pressed state | Instant |

Rules: no fade-up-on-scroll per section; no scroll hijacking; no parallax on text.

## 6. Conversion plan

- One action, **Book a 25-min call**, repeated in nav, hero, pricing (featured) and the close. Every one links to `#book`; the mailto fallback works without Calendly.
- Risk reversal next to every CTA: "2 weeks free, run by hand. No install, no card."
- Pricing is public: there's no "contact sales" wall, and partner pricing sits beside the future plans.
- Proof is honest: the founder note and labelled example data. No fake logos, testimonials or numbers.
- Objections are answered before the close (FAQ sits above the teal band).
- Measure later (E12): hero CTA rate, scroll depth to pricing, booking completes.

## 7. Acceptance criteria

- [ ] Lighthouse mobile: perf ≥ 95 · a11y ≥ 98 · BP 100 · SEO 100; LCP < 2.0s; CLS < 0.05; TBT < 100ms
- [ ] Entry JS ≤ 4KB raw; motion chunk ≤ 60KB gz; HTML ≤ 18KB gz
- [ ] All content readable with JS off and with reduced motion
- [ ] AA contrast on every text/background pair; visible focus; keyboard-operable tabs and FAQ
- [ ] No horizontal scroll at 360px; checked at 360 / 768 / 1440
- [ ] One H1; JSON-LD (Organization, SoftwareApplication, FAQPage) matches the visible FAQ
- [ ] Tests, typecheck, ESLint and Prettier green
- [ ] Awwwards-criteria score with screenshots, before and after

## 8. Mark (logo icon)

**Idea:** a pulse ring that forms a **C**. It's off-centre (thick where the wave starts, thinning toward its opening) with **one dot in the gap**: a rival's move travelling toward the one deal it reaches. It replaces the old ECG-heartbeat glyph, which said "health monitoring" and nothing about deals.

| | Spec |
| --- | --- |
| Source | `packages/landing/src/lib/mark.js` (single source for wordmark, favicon, app icon, OG card) |
| 24 grid (≥20px) | outer c(12,12) r9.25 · inner c(13.6,12) r6.1 · opening = radial cuts at ±36° · dot c(20.45,12) r2.1 · whole mark −0.6x for optical centring · thick side 4.75 → tail 1.93 |
| 16 grid (favicon) | separate cut: outer r6.6, inner c(8.8,8) r4.15, cuts ±40°, dot r1.6; tail ≥1.85px so it never goes soft |
| Colour | ring = ink or white; dot = violet `#c9b4fa` on indigo, violet-mid `#7b5cf0` on white (the only use of violet-mid) |
| Lockup | mark 1.12em, gap 0.32em, optically lowered 0.04em to sit on the wordmark baseline |
| Clear space | ≥ the dot's diameter on all sides |
| Motion | on hover the dot sends one ping (700ms, `--ease-out`); none under reduced motion |
| Don't | outline it, rotate it, recolour the ring violet, put the dot inside the ring, or use the 24 cut below 20px |

Generated files: `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` (`pnpm --filter @competepulse/landing icons`) and `public/og.png` (`… og`).
