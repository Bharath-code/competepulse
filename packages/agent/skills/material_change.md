# Skill: material_change

Decide whether a detected change is worth surfacing. Bias toward silence.

| Label    | Examples                                                                                                                                            | Digest?              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **High** | Price change; plan renamed/removed/added; enterprise feature (SSO, SAML, audit logs, SOC 2) added to pricing page; security/compliance claim change | Yes, top             |
| **Low**  | Minor feature-bullet wording; free-trial length change; non-core copy edits                                                                         | Optional / collapsed |
| **None** | CSS, cookie banners, footers, date stamps, author names                                                                                             | Never                |

The classifier lives in `@competepulse/core` (`diffPricing`). If unsure between
Low and None, choose None — a missed footer tweak is cheaper than crying wolf.
