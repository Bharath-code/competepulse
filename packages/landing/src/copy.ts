/**
 * All page copy in one place (PRD §2 job-to-be-done, §3 positioning, §6
 * battlecards). Editing the pitch should never require touching markup, and the
 * tests in `test/copy.test.ts` guard the promises the brief requires.
 */

export const brand = {
  name: "CompetePulse",
  tagline: "Slack-native competitive change agent",
  /** Sits under the nameplate. */
  strapline: "Competitive intelligence for teams without a competitive-intel team",
  /** Runs in the sticky bar, the way a newspaper repeats its title. */
  runningHead: "Pricing and changelog watches · Cited digests · Slack-native",
} as const;

export const meta = {
  title: "CompetePulse — what materially changed on your competitors, every morning in Slack",
  description:
    "CompetePulse watches your competitors' pricing and changelog pages, then posts a cited digest to Slack every weekday morning. No Klue bill, no Visualping noise.",
  ogAlt:
    "CompetePulse: every morning in Slack, what materially changed on your competitors — with links.",
} as const;

export const hero = {
  eyebrow: "Now taking 3 design partners",
  dateline: "Issue No. 1",
  /** The JTBD headline, verbatim from PRD §2. */
  headline: {
    lead: "Every morning in Slack:",
    emphasis: "what materially changed",
    trail: "on your competitors — with links.",
  },
  /** The one sentence: watches → cited digest → not Klue, not Visualping. */
  subhead:
    "CompetePulse watches your competitors' pricing and changelog pages, keeps only the changes that move deals, and posts a cited digest to your channel. No Klue bill. No Visualping noise.",
  ctaLabel: "Book a 15-min discovery call",
  ctaNote: "15 minutes, no demo theatre. Bring three competitor URLs and leave with a digest.",
  facts: [
    { label: "When", text: "Weekday mornings, in the channel your team already reads." },
    { label: "Proof", text: "Every line cites the page and the snapshot it came from." },
    { label: "Noise", text: "Footer edits, cookie banners and CSS churn never reach you." },
  ],
} as const;

export const digestPreview = {
  kicker: "Fig. 1 — The 8:30am digest",
  title: "The whole product is one message.",
  body: "Grouped by competitor, ranked by materiality, every line citing the page and snapshot it came from. Quiet competitors still get a line, so you know the watch ran.",
  caption:
    "Example digest. Acme and Northwind are placeholders — your watchlist is your competitors.",
  slack: {
    channel: "#competitive",
    appName: "CompetePulse",
    timestamp: "8:30 AM",
    digestTitle: "CompetePulse digest",
    digestDate: "2026-08-06",
    sections: [
      {
        competitor: "Acme",
        entries: [
          {
            materiality: "high" as const,
            summary: "Team plan moved $50 → $99 per seat/mo; SSO shifted from Team to Enterprise.",
            citation: "acme.com/pricing",
            why: "Why it matters: price moves change deal math and talk tracks.",
          },
        ],
      },
      {
        competitor: "Northwind",
        entries: [
          {
            materiality: "low" as const,
            summary: "Changelog: bulk CSV import shipped, Enterprise-only.",
            citation: "northwind.io/changelog",
            why: "Why it matters: minor, but worth a glance before the next enablement pass.",
          },
        ],
      },
    ],
    quiet: {
      competitors: ["Globex", "Initech", "Umbrella"],
      label: "All quiet — no material changes.",
    },
    threadPrompt: "Did Acme change SSO packaging?",
    threadReply:
      "Yes — SSO left the Team tier on Aug 6. Cited: acme.com/pricing, snapshot 08:12 UTC.",
  },
} as const;

export const howItWorks = {
  kicker: "Method",
  title: "Three steps, then it runs itself.",
  steps: [
    {
      number: "01",
      title: "Point it at the pages you already check",
      body: "Pricing, changelog, careers. Add them from Slack — no admin, no CSV, no onboarding call.",
      command: "/compete watch add acme.com/pricing",
    },
    {
      number: "02",
      title: "Every change gets judged, not just detected",
      body: "We snapshot each page, diff the structured extract, and score it against a materiality rubric. Price, packaging, positioning and hiring signals survive. CSS churn does not.",
      command: null,
    },
    {
      number: "03",
      title: "One cited digest, weekday mornings",
      body: "Posted to your channel with source links. Ask follow-ups in the thread — answers are grounded in the stored snapshots, or we say we don't know.",
      command: null,
    },
  ],
} as const;

export const alternatives = {
  kicker: "The options on the table",
  title: "You have already priced the alternatives.",
  columns: ["Option", "What it costs", "What it tells you", "What it leaves you doing"],
  rows: [
    {
      name: "Visualping, Distill",
      price: "$14–100 / mo",
      tells: "Something on the page changed.",
      leaves: "Reading diffs of cookie banners to find the one that mattered.",
    },
    {
      name: "Klue, Crayon",
      price: "$15k–40k+ / yr",
      tells: "Everything — if you staff someone to run it.",
      leaves: "Hiring a competitive-intel owner you did not budget for.",
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
    price: "$149–399 / mo",
    tells: "What materially changed, cited, in Slack.",
    leaves: "Reading one message and updating the talk track.",
  },
} as const;

export const concierge = {
  kicker: "Design partners",
  badge: "Free 14-day concierge",
  title: "Free 14-day concierge for 3 design partners.",
  body: "We run the watches by hand for your three closest competitors and deliver the digest every weekday morning. No install, no card, no contract — reply “stop” and it ends.",
  asksLabel: "Who this is for",
  asks: [
    "You sell B2B SaaS and your team lives in Slack",
    "Someone already keeps a competitor page nobody trusts",
    "You will tell us honestly when a digest was useless",
  ],
  ctaLabel: "Book a 15-min discovery call",
  couponLabel: "Pick a time",
  couponNote: "Fifteen minutes. Three competitors. One digest.",
  bookingFallbackNote: "Prefer email? Send us the three competitors you care about.",
} as const;

export const faq = [
  {
    question: "What counts as a material change?",
    answer:
      "Anything that touches price, packaging, positioning, feature availability, or hiring signal. Footer edits, cookie banners and CSS churn are scored as non-material and never reach your channel.",
  },
  {
    question: "Do I need to install anything to try it?",
    answer:
      "No. The 14-day concierge is run by hand: you send three competitor URLs, we deliver the digest every weekday morning.",
  },
  {
    question: "Where does the data come from?",
    answer:
      "Public web pages you nominate — typically pricing, changelog and careers pages. Every digest line links to the stored snapshot it was derived from.",
  },
] as const;

export const footer = {
  kicker: "Colophon",
  note: "We monitor public web pages you choose. No logins, no paywalls, no claims about non-public data.",
  colophon: "Set in Instrument Serif and IBM Plex. Built on Cloudflare. No cookies, no trackers.",
  copyright: `© ${new Date().getUTCFullYear()} ${brand.name}`,
} as const;
