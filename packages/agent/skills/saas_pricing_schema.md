# Skill: saas_pricing_schema

How to read a SaaS pricing page into the v1 extraction schema
(`PricingSnapshot` in `@competepulse/core`).

```json
{
  "currency": "USD",
  "plans": [{ "name": "Pro", "price_monthly": 99, "price_annual": 79, "unit": "seat" }],
  "features_called_out": ["SSO", "Audit logs"],
  "free_trial_days": 14,
  "notes": []
}
```

Guidance:

- Normalize currency to an ISO code; keep amounts numeric (no `$`).
- One entry per plan tier; use `null` for "contact us" / unlisted prices.
- `features_called_out` = features the page markets as plan differentiators.
- Put ambiguity or caveats in `notes`, never invented prices.
- Prefer this schema when labeling a watch `pricing`. Other labels
  (`changelog`, `docs`, `careers`) may return thinner extracts until their
  schemas ship.
