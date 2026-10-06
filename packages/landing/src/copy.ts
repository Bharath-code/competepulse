/**
 * All page copy in one place, mirroring the copy deck in docs/LANDING_DESIGN.md.
 * `test/copy.test.ts` guards the promises the page makes.
 */

export const brand = {
  name: "CompetePulse",
  tagline: "Deal-aware competitive intelligence for HubSpot and Slack",
} as const;

export const meta = {
  title: "CompetePulse: when a rival moves, the rep on the deal hears first",
  description:
    "CompetePulse finds the open HubSpot deals a competitor's change touches and messages each owner in Slack with proof and a line to use.",
  ogAlt:
    "CompetePulse: a rival raises its price, two open deals light up, and the rep gets a Slack message with proof and a line to use.",
} as const;

export const cta = {
  label: "Book a 25-min call",
  short: "Book a call",
  reassurance: "2 weeks free, run by hand. No install, no card.",
  mailSubject: "CompetePulse: 25-min discovery call",
} as const;

export const nav = [
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export const hero = {
  pill: "For HubSpot + Slack sales teams",
  headline: "When a rival moves, the rep on the deal hears first.",
  lead: "CompetePulse watches your competitors' pricing, packaging and launches, finds the open HubSpot deals each change touches, and messages the deal owner in Slack with proof and a line to use.",
  caption: "Example: Rival raises Pro to $79. Two open deals name Rival. Sam gets the message.",
  scene: {
    url: "rival.ai/pricing",
    plan: "Pro",
    before: "$49",
    after: "$79",
    deals: [
      { name: "Northwind", amount: "$18,000", stage: "Proposal", rival: true },
      { name: "Bluefin", amount: "$9,000", stage: "Demo", rival: false },
      { name: "Kestrel", amount: "$26,000", stage: "Negotiation", rival: true },
    ],
    dm: {
      to: "@sam",
      text: "Rival raised Pro to $79 this morning. Northwind ($18k) is up against them.",
      line: "“Same features, and our price didn’t move.”",
      approved: "Approved by Priya, PMM",
    },
    counter: { label: "Deals touched this week", value: 2 },
  },
} as const;

export const problem = {
  title: "Right now, your buyer tells your rep.",
  lead: "Alert tools ping a channel nobody reads. Enterprise CI costs $20k a year and a full-time owner. So the news usually arrives from the one person you didn't want it from.",
  week: [
    { when: "Mon 09:12", what: "Rival changes its pricing page." },
    { when: "Wed 14:30", what: "Your buyer: “Rival is $30 cheaper per seat now.”" },
    { when: "Wed 14:31", what: "Your rep improvises." },
    { when: "Fri", what: "The deal slips a quarter." },
  ],
  fix: {
    when: "Mon 09:40",
    what: "With CompetePulse, Sam has the change, the screenshot and a line to use. Two days early.",
  },
  footnote:
    "Illustrative week. The timings show how this usually plays out, not data from a customer.",
} as const;

export const product = {
  title: "One change, four steps, no new dashboard.",
  lead: "Everything happens in the tools your team already has open: HubSpot for deals, Slack for the message.",
  steps: [
    {
      id: "watch",
      tab: "Watch",
      title: "The pages that move deals.",
      body: "Pricing, packaging, changelog and docs. Cosmetic edits are dropped; real changes keep a before-and-after screenshot.",
    },
    {
      id: "match",
      tab: "Match",
      title: "The deals it touches.",
      body: "Read-only HubSpot access. Only open deals that name the rival. Closed deals stay quiet.",
    },
    {
      id: "message",
      tab: "Message",
      title: "The rep, not the channel.",
      body: "One DM to the deal owner, with proof and a line your PMM approved once for every rep facing that rival.",
    },
    {
      id: "learn",
      tab: "Learn",
      title: "What actually wins.",
      body: "Outcomes are logged next to the reply that went out. Win rates appear after 20 closed deals; before that, counts only.",
    },
  ],
  caption: "Example data. Rival, the deals and the people are placeholders.",
} as const;

export const compare = {
  title: "Every tool sees the change. Only one tells the right person.",
  columns: ["Option", "Cost", "Who hears about it"],
  rows: [
    {
      name: "Page-change alerts",
      examples: "Visualping, Unkover",
      price: "$25–100 / mo",
      who: "#competitors, muted by Thursday",
    },
    {
      name: "Enterprise CI",
      examples: "Klue, Crayon",
      price: "$20k–40k / yr",
      who: "Your CI manager, if you have one",
    },
    {
      name: "Pasting URLs into ChatGPT",
      examples: "Whoever remembers",
      price: "Tokens, plus your Friday",
      who: "Whoever asked, this week",
    },
  ],
  ours: {
    name: "CompetePulse",
    examples: "HubSpot + Slack",
    price: "$99–299 / mo",
    who: "Sam, the rep on Northwind",
  },
} as const;

export const pricing = {
  title: "Priced per team, not per seat.",
  lead: "More people in Slack should spread the product, not raise the bill.",
  partner: {
    title: "Today: 5 design-partner seats.",
    body: "2 weeks free, run by hand with your real rivals and deals. Then $49 a month, locked for 12 months. The plans below open after the program.",
  },
  plans: [
    {
      name: "Free",
      price: "$0",
      unit: "",
      featured: false,
      features: ["2 rivals", "Weekly Slack summary", "Rival dossier"],
    },
    {
      name: "Starter",
      price: "$99",
      unit: "/ mo",
      featured: false,
      features: ["5 rivals", "Daily alerts with screenshots", "Launch and news signals"],
    },
    {
      name: "Team",
      price: "$299",
      unit: "/ mo",
      featured: true,
      features: [
        "15 rivals",
        "HubSpot deal matching",
        "DMs to deal owners",
        "Approved replies",
        "Win / loss tracking",
      ],
    },
    {
      name: "Business",
      price: "$699+",
      unit: "/ mo",
      featured: false,
      features: ["Unlimited rivals", "Regional pricing", "API access"],
    },
  ],
} as const;

export const founder = {
  quote:
    "CompetePulse is early, and that’s the offer. For two weeks I run it by hand for your team, with your real rivals and your real deals. If it doesn’t earn a place in your week, you’ve spent 25 minutes.",
  name: "Bharath",
  role: "Founder, CompetePulse",
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
    question: "Where does the competitor data come from?",
    answer:
      "Public pages only: pricing, changelog, docs and news. No logins to rival products, no paywalls. Every message links to the stored snapshot it came from.",
  },
  {
    question: "Do you support Salesforce?",
    answer:
      "Not yet. HubSpot comes first. If you're on Salesforce, say so on the call: it decides what we build next.",
  },
  {
    question: "What happens after the two weeks?",
    answer:
      "You decide. Keep it at $49 a month, locked for 12 months, in return for honest weekly feedback, or walk away. Nothing renews by itself.",
  },
] as const;

export const close = {
  title: "Find out which of your deals your rivals touched this month.",
  bookingLabel: "Pick a time",
  bookingNote: "25 minutes. Bring your three closest rivals.",
  directNote: "The calendar opens in a new tab.",
  pendingNote: "Scheduling link is being set up. Email works right now.",
  emailNote: "Prefer email?",
} as const;

export const footer = {
  note: "We watch public web pages and read only the HubSpot deals you allow.",
  colophon:
    "Set in Bricolage Grotesque, Source Sans 3 and JetBrains Mono. Motion by GSAP. Built on Cloudflare. No cookies, no trackers.",
  copyright: `© ${new Date().getUTCFullYear()} ${brand.name}`,
} as const;
