# Materiality rubric v0 — Path A3 / P0-7

Human judgment for “should this wake a PMM?” Aligns with eval labels in `packages/core/src/eval/fixtures.ts` and the `material_change` agent skill.

## Labels

| Label | Digest? | Meaning |
|-------|---------|---------|
| **high** | Yes, top | Price change, plan add/remove, packaging move that changes deal math, enterprise feature gate (SSO, SCIM, etc.) |
| **low** | Optional | Minor feature, trial-length tweak, secondary packaging |
| **none** | Never | Noise: footer, cookies, CSS, copy rewrite with no commercial meaning |

Precision gate in CI scores **precision on `high`** ≥ 85%. Prefer false negatives over cry-wolf false positives.

## Decision questions

1. Would a sales rep change a talk track or discount this week?
2. Would enablement update a battlecard?
3. Is the only delta visual/HTML structure?

If (1) or (2) → usually `high`. If only (3) → `none`.

## Seed examples (fixture-aligned)

| # | Case | From → To | Label | Why |
|---|------|-----------|-------|-----|
| 1 | Acme Pro price hike | $99 → $129/seat | high | Price moves deal math |
| 2 | Acme plan removed | Starter removed | high | Packaging change |
| 3 | SSO moved to Enterprise | Team lost SSO | high | Feature gate |
| 4 | Dark mode feature | features += Dark mode | low | Minor feature |
| 5 | Cookie banner only | HTML noise | none | Not commercial |
| 6 | Footer copyright year | 2025 → 2026 | none | Noise |
| 7 | Trial 14 → 21 days | trial_days | low | Secondary |
| 8 | New Enterprise tier | plan added | high | Packaging |
| 9 | Changelog: CSV import Ent-only | feature note | low | Worth a glance |
| 10 | Identical snapshot | no diff | none | No change |
| 11 | Currency currency USD→EUR same number | ambiguous | high* | Treat as high until confirmed cosmetic |
| 12 | Marketing headline rewrite | H1 only | none | Copy without commercial change |
| 13 | Seat minimum 1 → 5 | pricing constraint | high | Deal math |
| 14 | Free tier killed | plan removed | high | Packaging |
| 15 | Docs typo fix | docs | none | Not CI-relevant |

\*When unsure between `high` and `low`, label `high` only if a human would want a Slack ping; otherwise `low`/`none`.

## Live-label log (add during concierge)

| Date | Partner | URL | Human label | Notes |
|------|---------|-----|-------------|-------|
| | | | | |

Target: **15+ live labeled examples** by end of Phase A (in addition to the seed table).
