# Discovery calls — deal-aware pivot (Oct 2026)

Replaces the PRD Appendix C script, which was written for the old digest product. This script tests two things:

1. **Pain:** does "a competitor move hits live deals" rank top-3? This is the day-21 gate: ≥5 of 20 calls.
2. **Data:** is the competitor written on each HubSpot deal? If it isn't, the product can't find deals. See the [HubSpot deal match](https://claude.ai/artifact/Q9tUeWB2fWd7NMRrt6wfYA) explainer.

Format: 25 min, video, screen share if they'll do it. Ask about the past, never about the future. Write down their exact words.

## Before the call (10 min)

- Get their top 3 rivals from G2 or their site, and the rivals' pricing and changelog URLs.
- Find one real recent change by a rival (`firecrawl search` / scrape). Keep it for the close.
- Fill in the row in `docs/data/icp-list.csv`.

## 1. Open (2 min)

- "I'm researching how small sales teams handle competitors mid-deal. No pitch. I'll show you something only at the end if it's relevant."
- "What's your role, and how big is the sales team?"

## 2. Their world (4 min)

- "Where do deals live? HubSpot, Salesforce, a spreadsheet?" **Not HubSpot → note it and continue, but the call doesn't count as ICP.**
- "Who sells? Founder, AEs, both? How many open deals right now, roughly?"
- "Who owns competitive stuff today: battlecards, rival pricing, 'how we beat X'?" (often: nobody, or the founder)

## 3. The last time (7 min) — the most important part

Get one specific story. Keep pulling on it.

- "Think of the last deal where a competitor came up. Which one, and who was it?"
- "When did you first hear they were in the deal? Who told you?"
- "Did that competitor change anything during the deal — price, a feature, a promo?"
  - "How did you find out? The buyer? Slack? By accident?"
  - "How long after it happened?"
  - "What did the rep say to the buyer? Who helped them?"
- "How did the deal end? Why?"
- "How often does that happen? Last month, how many times?"

Signals: **strong** = a named deal, a date, a cost ("we lost $30k because…"). **Weak** = "yeah, that happens sometimes."

## 4. The competitor field (6 min) — data check

Ask in this order. Don't say "field" until they bring it up.

1. "When a deal has a competitor, where does that get written down?"
   - Listen: a HubSpot field, notes, Slack, the rep's head, nowhere.
2. "Is there a field on the deal for it? What's it called? Is it a dropdown or free text? One competitor or several?"
3. **Measure, don't estimate.** "Could you filter your open deals for 'competitor is known' and tell me the count, out of how many?"
   - If they won't share their screen: "Of your last 10 closed deals, how many have it filled in?"
4. "Who fills it in, and at what stage? Is it required?"
5. "When you lose, do you record why? Is 'lost to competitor' an option? Does it name which one?"
6. "Have you ever tried to get reps to fill in a CRM field? What happened?"
7. "Where do call notes or recordings live? In HubSpot, Gong, nowhere?" (tells us if option D is possible later)
8. "Do people use the same email in HubSpot and Slack?" (quick yes/no)

## 5. Rank the problems (3 min)

Show this list in the shared screen or paste it in chat. The order is shuffled on purpose. Ask: **"Which three cost you the most deals or time this quarter? In order."**

- A. Not enough pipeline or leads
- B. Battle cards are stale or nobody uses them
- C. **Reps get caught off guard when a competitor changes something mid-deal**
- D. Hard to know why we lose deals
- E. Don't know what competitors charge or how they package
- F. New reps take too long to ramp

Record where they put **C**: 1, 2, 3, or not in the top 3. **C in the top 3 counts toward the day-21 gate.** D or E in the top 3 is a secondary signal: note it, but it doesn't count.

## 6. Money (2 min)

- "What do you pay for anything competitive today? Tools, an agency, someone's time?"
- "If something fixed your #1 from that list, who would sign off, and around what monthly amount would you not need approval?"

## 7. Close (1 min) — only now show anything

- Show the real rival change you found: "<Rival> changed <X> on <date>. Here's the screenshot."
- Offer: "For 2 weeks, I'll watch your 3 rivals. When one moves, I'll tell you which open deals it hits and draft what the rep should say. I need a CSV of open deals with name, owner, stage, amount and competitor. After that it's $49/month, locked for 12 months, for weekly feedback."
- Ask for the next concrete step: CSV by <date>, plus a Slack channel invite.

## After the call (5 min)

Add these columns to the row in `docs/data/icp-list.csv`:

| Column | Values |
| --- | --- |
| `crm` | `hubspot` / `salesforce` / `other` / `none` |
| `story` | `strong` / `weak` / `none` |
| `rank_c` | `1` / `2` / `3` / `no` |
| `comp_field` | `none` / `free-text` / `dropdown` / `multi-select` |
| `fill_pct` | number, plus `m` if measured or `e` if estimated (e.g. `35m`) |
| `lost_reason_names_rival` | `y` / `n` |
| `notes_in_crm` | `hubspot` / `gong` / `other` / `none` |
| `same_email` | `y` / `n` / `?` |
| `commitment` | `none` / `csv` / `slack` / `paid` (the highest one reached) |
| `quote` | their exact best line |

## Reading the results (after 20 calls)

**Pain gate (from the strategy, fixed):** fewer than 5 of 20 with `rank_c` in 1–3 → switch ideas.

**Data gate (proposed, adjust before call 1, then don't move it):** use the median `fill_pct` across HubSpot calls.

| Median fill rate | What we build |
| --- | --- |
| ≥ 50% | Option A: read their field. Simplest product. |
| 20–49% | A + B + C: read or create the field, and ask reps in Slack to fill gaps. |
| < 20% | Matching only works with D (read notes and calls). Bigger, slower, needs a privacy review. Rethink before building. |

**Commitment beats talk.** A CSV sent in week 1 is worth more than "this is so cool." Count `commitment ≥ csv` separately; it predicts the day-45 gate (3 paying).

## Don'ts

- Don't pitch before section 7.
- Don't ask "would you use…?" or "would you pay…?". Ask what they did last time.
- Don't put words in their mouth: no "isn't it annoying when…".
- Don't count a non-HubSpot company toward the gates.
- Don't fill `fill_pct` from a guess when they could have measured it. Mark estimates with `e`.
