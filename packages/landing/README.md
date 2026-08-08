# @competepulse/landing

The CompetePulse marketing page — roadmap task **P0-3 (Landing page + Calendly)**. One
static page whose only job is to turn an outbound click into a booked 15-minute
discovery call.

## Why it is built this way

| Decision                                               | Reason                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro, `output: "static"`                              | Ships HTML and CSS with no framework runtime. The whole page is ~4 kB of gzipped HTML and under 2 kB of JavaScript.                                  |
| No web fonts                                           | Zero font requests, zero layout shift. The system stack renders instantly on every device.                                                           |
| Stylesheet inlined                                     | One page, small CSS — inlining removes a render-blocking round trip.                                                                                 |
| Calendly loaded lazily                                 | The widget bundle is larger than the entire page. It is fetched only when the booking section approaches the viewport, or on a call-to-action click. |
| Copy centralised in `src/copy.ts`                      | The pitch can be reviewed and tested without touching markup, and `test/copy.test.ts` guards the promises the brief requires.                        |
| Palette shared with `packages/worker/src/dashboard.ts` | The site and the product read as one thing.                                                                                                          |

## Commands

```bash
pnpm --filter @competepulse/landing dev        # http://localhost:4321
pnpm --filter @competepulse/landing build      # → dist/
pnpm --filter @competepulse/landing preview    # serve dist/
pnpm --filter @competepulse/landing typecheck  # astro check
pnpm --filter @competepulse/landing test       # unit + built-HTML assertions
pnpm --filter @competepulse/landing og         # regenerate public/og.png
```

From the repo root, `pnpm dev:landing` is a shortcut for the dev server.

## Configuration

Copy [`.env.example`](./.env.example) to `.env`. Every value is `PUBLIC_` and gets
inlined into the static output, so none of them may be secret.

| Variable               | Effect when unset                                                       |
| ---------------------- | ----------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`      | Canonical URL defaults to `https://competepulse.com`.                   |
| `PUBLIC_CALENDLY_URL`  | Every call-to-action becomes a `mailto:` link and the embed is omitted. |
| `PUBLIC_CONTACT_EMAIL` | Defaults to `hello@competepulse.com`.                                   |
| `PUBLIC_APP_URL`       | The footer dashboard link is hidden.                                    |

`PUBLIC_CALENDLY_URL` is validated at build time: a non-absolute URL, a non-HTTPS
scheme, or a host that is not `calendly.com` fails the build rather than shipping
a dead button.

## How the booking flow degrades

Every call-to-action on the page is an anchor to `#book`, so there is exactly one
destination and one thing to measure.

1. **No JavaScript, or Calendly blocked** — the booking panel shows a normal link
   to the Calendly page. This is the markup that is always rendered.
2. **JavaScript available** — [`src/scripts/calendly-embed.ts`](./src/scripts/calendly-embed.ts)
   loads `widget.js` and `widget.css` when the panel nears the viewport (or
   immediately on a call-to-action click), then mounts the inline widget.
3. **Widget confirms it painted** — Calendly posts a `calendly.*` message; the
   panel switches to `data-calendly-state="ready"` and the link steps aside.
4. **Bundle never loaded** — `error`: the empty box is hidden and the link stays.
5. **Bundle loaded and mounted but never confirmed within 8s** — `unconfirmed`:
   the widget stays visible _and_ the link stays, because hiding a calendar that
   is probably working would be worse than one redundant link.

A visitor is never left with an empty box, and a working calendar is never
hidden on the strength of a missing analytics message.

Links carry `utm_source=landing`, `utm_medium=cta|embed`,
`utm_campaign=design-partners` and `utm_content=<placement>` so bookings can be
attributed to the spot that was clicked.

## Deploying

The build output is plain static files, so any host works. Cloudflare keeps it
next to the Worker:

```bash
PUBLIC_SITE_URL=https://competepulse.com \
PUBLIC_CALENDLY_URL=https://calendly.com/<user>/15min \
  pnpm --filter @competepulse/landing build

pnpm --filter @competepulse/landing deploy      # wrangler, assets-only Worker
```

[`wrangler.jsonc`](./wrangler.jsonc) declares an assets-only Worker (no `main`).
[`public/_headers`](./public/_headers) carries the cache and security headers,
including a Content Security Policy that allows exactly the Calendly origins the
embed needs. Because Calendly's widget sets `style` attributes from JavaScript,
`style-src` must include `'unsafe-inline'`; to keep `script-src` at `'self'`,
`astro.config.mjs` forces our own script to be an external file rather than an
inline block.

## Social card

`public/og.png` is a checked-in artifact rendered from an SVG by
[`scripts/generate-og-image.mjs`](./scripts/generate-og-image.mjs). Re-run
`pnpm --filter @competepulse/landing og` after changing the headline and commit
the result — that keeps the build free of an image pipeline.
