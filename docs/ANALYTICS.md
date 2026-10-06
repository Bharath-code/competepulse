# Analytics (PostHog)

- Worker events (`distinct_id` = workspace id, no person profiles): `install` (Slack OAuth) → `alert_delivered` (digest posted) → `response_approved` (battlecard approved, once per draft) → `paid` (Dodo `active`, webhook-deduped).
- Landing events (cookieless beacon, off under DNT or without key): `landing_view`, `landing_cta {placement}`.
- Keys: worker `POSTHOG_API_KEY` (`wrangler secret put`), landing `PUBLIC_POSTHOG_KEY` at build. Blank = off.
- Funnel insight: the four worker events in order, "first time" per workspace.
- North star, interim (deal matching ships in E5/E7): approved responses per week. Replace with `deals_touched` summed on `response_approved` once `deal_alerts` exists.

```sql
SELECT toStartOfWeek(timestamp) AS week, count() AS approved_responses
FROM events WHERE event = 'response_approved' GROUP BY week ORDER BY week
```
