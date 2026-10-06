# Landing v2: Awwwards-criteria self-score (6 Oct 2026)

Scored from screenshots (1440 and 375 wide) and Lighthouse 12. Weights: Design 40 · Usability 30 · Creativity 20 · Content 10. v1 = merged PR #8 (three.js pulse field).

| Criterion    | v1      | v2      | Evidence                                                                                                                                                                                                                                                                                                                                |
| ------------ | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design       | 7.5     | 8.0     | Three-canvas editorial system from DESIGN.md (indigo dusk hero → white body → teal close); variable-weight type at 460/540; crisp product mock-ups. Body sections (tabs, comparison, pricing) are well made but familiar SaaS layouts.                                                                                                  |
| Usability    | 8.5     | 9.5     | Lighthouse mobile 100 / 100 / 100 / 100 (FCP 1.1s, LCP 1.7s, TBT 0ms, CLS 0.013); desktop perf 100, a11y 100. Entry JS 3.9KB; GSAP 45KB gz loads only when a scene is about to be seen. Works with JS off and reduced motion; product steps are native radios (arrow keys). Nav links collapse to the CTA only on mobile, with no menu. |
| Creativity   | 7.0     | 7.0     | Hero scene tells the whole product in ~6s (scramble → wire → deals → DM overshoot → tick → counter); scroll-scrubbed week. Purposeful, but no novel interaction a jury would remember; three.js removed.                                                                                                                                |
| Content      | 8.0     | 8.5     | Copy deck answers each objection in order; public pricing plus the honest partner offer; founder note instead of fake logos. Still no real customer proof.                                                                                                                                                                              |
| **Weighted** | **7.8** | **8.3** |                                                                                                                                                                                                                                                                                                                                         |

## Acceptance criteria (docs/LANDING_DESIGN.md §7)

- [x] Lighthouse mobile perf ≥95 · a11y ≥98 · BP 100 · SEO 100; LCP <2.0s; CLS <0.05; TBT <100ms
- [x] Entry JS ≤4KB (3,880 B) · motion chunk ≤60KB gz (45KB) · HTML ≤18KB gz (~12KB)
- [x] Readable with JS off and reduced motion (finished frames are server-rendered)
- [x] AA contrast (fixed strike grey and timeline fade after the first audit), visible focus, keyboard tabs and FAQ
- [x] No horizontal scroll at 375; checked at 375 / 1440 (768 not screenshotted)
- [x] 43 landing tests, typecheck, ESLint, Prettier green

## Gap to Site of the Day (~8.7+)

1. **One interaction only this site has:** e.g. "type a rival's domain" → live mini-dossier from cached data. That's the creativity jump.
2. **Real proof:** one partner quote or a real (anonymised) DM.
3. **Brand imagery:** the reference leans on a half-bleed portrait; a commissioned photo or illustration of "the rep at dusk" would lift Design.
4. **Mobile nav:** add a compact menu for the three anchors.
5. **Conversion is unmeasured:** wire PostHog (REWRITE_PLAN E12) before judging "highly converting".
