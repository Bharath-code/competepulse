/**
 * All page copy in one place (PRD §2 job-to-be-done, §3 positioning, §6
 * battlecards). Editing the pitch should never require touching markup, and the
 * tests in `test/copy.test.ts` guard the promises we make here.
 */

export const brand = {
  name: "CompetePulse",
  tagline: "Slack-native competitive change agent",
} as const;

export const meta = {
  title: "CompetePulse — what materially changed on your competitors, every morning in Slack",
  description:
    "CompetePulse watches your competitors' pricing and changelog pages, then posts a cited digest to Slack every weekday morning. No Klue bill, no Visualping noise.",
  ogAlt:
    "CompetePulse: every morning in Slack, what materially changed on your competitors — with links.",
} as const;

export const hero = {
  eyebrow: "Taking 3 design partners",
  /** The JTBD headline, verbatim from PRD §2. */
  headline: {
    lead: "Every morning in Slack:",
    emphasis: "what materially changed on your competitors",
    trail: "— with links.",
  },
  /** The one sentence: watches → cited digest → not Klue, not Visualping. */
  subhead:
    "CompetePulse watches your competitors' pricing and changelog pages, keeps only the changes that move deals, and posts a cited digest to your channel. No Klue bill. No Visualping noise.",
  ctaLabel: "Book a 15-min discovery call",
  ctaNote: "15 minutes, no demo theatre. Bring three competitor URLs and leave with a digest.",
  proofPoints: [
    "Weekday mornings, in your channel",
    "Every line cites its snapshot",
    "No footer or cookie-banner noise",
  ],
} as const;

export const digestPreview = {
  kicker: "The whole product, in one message",
  title: "This is what lands at 8:30am.",
  body: "Grouped by competitor, ranked by materiality, every line citing the page and snapshot it came from. Quiet competitors get one line, not silence — so you know the watch ran.",
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
  kicker: "How it works",
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
  kicker: "Why not the obvious options",
  title: "You have already priced the alternatives.",
  columns: [
    {
      name: "Visualping, Distill",
      price: "Cheap, and loud",
      claim: "They tell you something changed.",
      counter: "We tell you what mattered, why it matters, and where we read it.",
    },
    {
      name: "Klue, Crayon",
      price: "$15k–$40k+/yr",
      claim: "A competitive-intel program for teams with a competitive-intel owner.",
      counter: "You do not have one. Take 80% of the value without the headcount or the contract.",
    },
    {
      name: "Pasting URLs into ChatGPT",
      price: "Tokens, plus your Friday",
      claim: "No schedule, no memory, no audit trail.",
      counter: "We keep versioned history, wake up on our own, and refuse to answer uncited.",
    },
  ],
} as const;

export const concierge = {
  badge: "Free 14-day concierge",
  title: "Free 14-day concierge for 3 design partners.",
  body: "We run the watches by hand for your three closest competitors and deliver the digest every weekday morning. No install, no card, no contract — reply “stop” and it ends.",
  asks: [
    "You sell B2B SaaS and your team lives in Slack",
    "Someone already keeps a competitor page nobody trusts",
    "You will tell us honestly when a digest was useless",
  ],
  ctaLabel: "Book a 15-min discovery call",
  bookingHeading: "Pick a time",
  bookingFallbackNote: "Prefer email? Send us the three competitors you care about.",
} as const;

export const footer = {
  note: "We monitor public web pages you choose. No logins, no paywalls, no claims about non-public data.",
  copyright: `© ${new Date().getUTCFullYear()} ${brand.name}`,
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
