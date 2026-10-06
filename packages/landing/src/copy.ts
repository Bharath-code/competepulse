/**
 * All page copy in one place. Positioning follows docs/STRATEGY.md (Oct 2026
 * pivot): deal-aware competitive response for HubSpot + Slack teams. The tests
 * in `test/copy.test.ts` guard the promises the page makes.
 */

export const brand = {
  name: "CompetePulse",
  tagline: "Deal-aware competitive intelligence for HubSpot and Slack",
  strapline: "Competitive response for teams without a competitive-intel team",
  runningHead: "Rival moves, matched to your open HubSpot deals, in Slack",
} as const;

export const meta = {
  title: "CompetePulse: when a rival moves, the rep on the deal hears first",
  description:
    "CompetePulse finds the open HubSpot deals a competitor's change touches and messages each owner in Slack with proof and a line to use.",
  ogAlt:
    "CompetePulse: when a rival changes pricing, the rep on the affected deal gets a Slack message with proof and a talk track.",
} as const;

export const hero = {
  eyebrow: "Taking 5 design partners",
  headline: ["When a rival moves,", "the rep on the deal", "hears first."],
  subhead:
    "CompetePulse watches your competitors, finds the open HubSpot deals each change touches, and messages the deal owner in Slack with proof and a line to use. Then it tracks whether you won.",
  ctaLabel: "Book a discovery call",
  ctaNote: "25 minutes. Bring your three closest competitors.",
  figure: {
    rival: "Rival raised Pro $49 → $79",
    deals: [
      { name: "Northwind", amount: "$18k" },
      { name: "Kestrel", amount: "$26k" },
    ],
    dm: "DM → deal owners",
    caption:
      "One rival move, drawn live. Deals facing that rival light up as the change reaches them.",
  },
} as const;

export const story = {
  title: "Four beats, from their price page to your win column.",
  intro: "Every message carries the evidence. Nobody gets pinged about a deal they don't own.",
  caption: "Example data. Rival, Northwind, Kestrel and the people are placeholders.",
  beats: [
    {
      id: "change",
      title: "Rival raises Pro from $49 to $79.",
      body: "We watch their pricing, changelog and docs pages. Cosmetic edits are dropped. Price and packaging moves are kept, with a before-and-after screenshot.",
    },
    {
      id: "deals",
      title: "Two of your open deals are up against them.",
      body: "We read your open HubSpot deals, read-only, and match the ones where Rival is the named competitor. Closed deals stay quiet.",
    },
    {
      id: "dm",
      title: "Sam hears about Northwind before the buyer brings it up.",
      body: "The deal owner gets a direct message: what changed, the screenshot, and one line to use. Your PMM approves the line once, and every rep facing Rival gets it.",
    },
    {
      id: "result",
      title: "You see which replies win.",
      body: "When deals close, we log the outcome next to the reply that went out. Over a quarter you learn what actually beats each rival.",
    },
  ],
} as const;

export const howItWorks = {
  kicker: "Setup",
  title: "Running in one afternoon.",
  steps: [
    {
      number: "1",
      title: "Connect HubSpot and Slack",
      body: "Read-only access to open deals and their owners. We never change a deal unless you turn on write-back.",
      command: null,
    },
    {
      number: "2",
      title: "Name your rivals",
      body: "Type a domain. We find their pricing, changelog and docs pages and show you a dossier of their last 90 days.",
      command: "/compete add rival.ai",
    },
    {
      number: "3",
      title: "Tell us where the competitor lives",
      body: "Point us at your competitor field on deals. No field? We add one and ask reps in Slack, one tap per deal.",
      command: null,
    },
  ],
} as const;

export const alternatives = {
  kicker: "Compared",
  title: "Alerts tell you something changed. We tell you which deal it hits.",
  columns: ["Option", "What it costs", "What it tells you", "What it leaves you doing"],
  rows: [
    {
      name: "Page-change alerts (Visualping, Unkover)",
      price: "$25–100 / mo",
      tells: "A page you watch changed.",
      leaves: "Guessing which deals it affects, and who should hear.",
    },
    {
      name: "Enterprise CI (Klue, Crayon)",
      price: "$20k–40k / yr",
      tells: "Deal-level intel, once someone runs it.",
      leaves: "Hiring the competitive-intel owner you didn't budget for.",
    },
    {
      name: "Pasting URLs into ChatGPT",
      price: "Tokens, plus your Friday",
      tells: "Whatever you remembered to ask this week.",
      leaves: "Being the schedule, the memory and the audit trail.",
    },
  ],
  ours: {
    name: "CompetePulse",
    price: "$99–299 / mo",
    tells: "Which open deal a rival's move hits, with proof and a line to use.",
    leaves: "Approving the reply, then seeing whether it won.",
  },
} as const;

export const concierge = {
  kicker: "Design partners",
  badge: "2 weeks free, run by hand",
  title: "Five design-partner seats.",
  body: "For two weeks we run it by hand: we watch your three closest rivals and match their moves to a CSV of your open deals. If it earns its keep, it's $49 a month, locked for a year, in return for honest weekly feedback.",
  asksLabel: "A good fit if",
  asks: [
    "You sell B2B software and track deals in HubSpot",
    "Your sellers live in Slack",
    "Your rivals change pricing or packaging every few months",
  ],
  ctaLabel: "Book a discovery call",
  couponLabel: "Pick a time",
  couponNote: "25 minutes. Three rivals. One honest answer.",
  bookingFallbackNote: "Prefer email? Send us your three closest competitors.",
} as const;

export const faq = [
  {
    question: "What if we don't record competitors on deals?",
    answer:
      "Most teams don't, consistently. We can add a Competitors field and ask reps in Slack, one tap per deal. If neither works for your team, we'll tell you on the first call.",
  },
  {
    question: "What do you read from HubSpot?",
    answer:
      "Open deals with their stage, amount, owner and competitor field, read-only. We don't touch contacts, emails or notes, and we never change a deal unless you turn on write-back.",
  },
  {
    question: "What counts as a material change?",
    answer:
      "Price, packaging, plan limits, positioning and feature availability. Footer edits, cookie banners and CSS churn are dropped and never reach a rep.",
  },
  {
    question: "Do you support Salesforce?",
    answer:
      "Not yet. HubSpot comes first. If you're on Salesforce, tell us on the call: it decides what we build next.",
  },
] as const;

export const footer = {
  kicker: "Colophon",
  note: "We watch public web pages and read the HubSpot deals you allow. No logins to rival products, no paywalls, no claims about non-public data.",
  colophon:
    "Set in Bricolage Grotesque, Source Sans 3 and JetBrains Mono. 3D with three.js, motion with GSAP. Built on Cloudflare. No cookies, no trackers.",
  copyright: `© ${new Date().getUTCFullYear()} ${brand.name}`,
} as const;
