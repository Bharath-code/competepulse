# Go-live checklist — Path A1 (landing + Calendly)

Founder-operated steps to put the acquisition surface live. Code is ready in `packages/landing`.

## Prerequisites

- [ ] Domain registered (recommended: `competepulse.com`)
- [ ] Domain DNS on Cloudflare (same account as Workers)
- [ ] Calendly account with a **15-minute discovery** event
- [ ] Event description matches landing CTA: bring three competitor URLs

## Configure

1. Copy [`packages/landing/.env.example`](../packages/landing/.env.example) → `packages/landing/.env`
2. Set:

```bash
PUBLIC_SITE_URL=https://competepulse.com
PUBLIC_CALENDLY_URL=https://calendly.com/<your-user>/15min
PUBLIC_CONTACT_EMAIL=hello@competepulse.com
```

3. Verify Calendly URL is `https` + host `calendly.com` (build fails otherwise).

## Build, test, deploy

```bash
PUBLIC_SITE_URL=https://competepulse.com \
PUBLIC_CALENDLY_URL=https://calendly.com/<your-user>/15min \
  pnpm --filter @competepulse/landing test

PUBLIC_SITE_URL=https://competepulse.com \
PUBLIC_CALENDLY_URL=https://calendly.com/<your-user>/15min \
  pnpm --filter @competepulse/landing build

pnpm --filter @competepulse/landing deploy
```

4. In Cloudflare dashboard → Workers → `competepulse-landing` → Custom Domains → attach apex + `www`.

## Acceptance criteria

- [ ] `https://<domain>/` loads over HTTPS
- [ ] OG title/description match [`packages/landing/src/copy.ts`](../packages/landing/src/copy.ts) `meta`
- [ ] Primary CTA opens live Calendly (not `mailto:`)
- [ ] Test booking creates calendar event + confirmation email
- [ ] `pnpm --filter @competepulse/landing test` passes with env set

## Status

| Item | Owner | Status |
|------|-------|--------|
| Code + deploy script | Eng | Ready |
| Domain + DNS | Founder | Pending |
| Calendly event URL | Founder | Pending |
| Production deploy | Founder | Pending |
