# Landing: Awwwards-criteria self-score (6 Oct 2026)

Scored from screenshots (desktop 1440, mobile 390) and Lighthouse 12 mobile. Weights: Design 40 · Usability 30 · Creativity 20 · Content 10.

| Criterion    | Before (21c86b7) | After   | Evidence                                                                                                                                                                                    |
| ------------ | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design       | 6.0              | 7.5     | Coherent token system kept; hero is now one composition (headline + live instrument). Lower half (setup, table, FAQ) still conventional.                                                    |
| Usability    | 8.0              | 8.5     | Lighthouse mobile perf 95 · a11y 97→fixed contrast · BP 100 · SEO 100; LCP 1.9s, CLS 0, TBT 0ms. No-JS / reduced-motion get a static poster. Entry JS 4KB; three.js + GSAP lazy (176KB gz). |
| Creativity   | 4.0              | 7.0     | Pulse field encodes the product (rival ring → deals light → beam to DM). Sticky-stage scroll story is a familiar pattern.                                                                   |
| Content      | 5.0 (pre-pivot)  | 8.0     | Copy matches STRATEGY.md; objections answered (empty competitor field, read-only); example data labelled. No real customer proof yet.                                                       |
| **Weighted** | **6.1**          | **7.8** |                                                                                                                                                                                             |

## Gap to SOTD (~8.5+)

1. Real proof: one design-partner quote or a real (anonymised) DM screenshot.
2. Lower half: give the comparison table a visual idea (e.g. the same pulse field, "who hears" per tool).
3. Story stage: reduce dead space between beats (78vh → ~60vh) and add a scrubbed transition between pictures.
4. Brand moments: page-load sequence linking the masthead pulse glyph to the hero ring; custom OG image of the field.
5. Re-run Lighthouse after the contrast fix; test Safari/Firefox WebGL and a low-end Android.
