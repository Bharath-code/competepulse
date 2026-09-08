/**
 * Interview briefing for CompetePulse — architecture, workflow, stack tradeoffs,
 * and drillable Q&A. Kept as data so the interactive page stays markup-thin and
 * you can edit talking points without fighting Astro components.
 */

export const interviewMeta = {
  title: "CompetePulse — interview brief",
  description:
    "Interactive prep: architecture, crawl→digest pipeline, tech-stack tradeoffs, and drillable interview answers for CompetePulse.",
  kicker: "Private briefing · not indexed",
  headline: "Explain CompetePulse like you built it.",
  lead: "Use this page to rehearse the pitch, defend every stack choice, walk the pipeline, and drill answers out loud. Reveal answers only after you try first.",
} as const;

export const nav = [
  { id: "pitch", label: "Pitch" },
  { id: "architecture", label: "Architecture" },
  { id: "pipeline", label: "Pipeline" },
  { id: "stack", label: "Stack & tradeoffs" },
  { id: "quality", label: "Quality / evals" },
  { id: "drill", label: "Interview drill" },
  { id: "your-story", label: "Your story" },
] as const;

/** 30-second and 2-minute pitches — say these out loud. */
export const pitches = {
  thirtySeconds: {
    label: "30 seconds",
    text: "CompetePulse is a Slack-native competitive intelligence agent for mid-market B2B SaaS. Teams add competitor pricing and changelog URLs; we crawl on a schedule, extract structured facts, classify material changes with a precision eval gate, and post a cited weekday digest. Humans approve before anything becomes a battlecard. It's CI without a CI team — not Klue's price tag, not Visualping's noise.",
  },
  twoMinutes: {
    label: "2 minutes",
    text: "Mid-market PMMs and enablement leads need to know when competitors change pricing or features, but Klue/Crayon are $15–40k and Visualping alerts on CSS. CompetePulse lives in Slack: slash commands manage watches; Cloudflare Workers fan out crawls via Queues; Firecrawl scrapes into LLM-ready JSON with Browser Run fallback; snapshots land in R2; a deterministic materiality classifier in our core package scores high/low/none; weekday digests post with citations. The agent layer owns tools, digest voice, Q&A grounded in snapshots, and HITL battlecard approve/reject. Billing is Dodo Payments (Starter/Pro). Phase 1 eng is complete; we gate shipping on ≥85% precision against a 20-page human-labeled eval set. The moat thesis is precision plus immutable change history plus Slack workflow habit.",
  },
} as const;

export const problemSolution = {
  problem: [
    "Sales learns about a price cut mid-call → lost deals / panic discounting",
    "Feature launches missed for weeks → stale battlecards",
    "Notion CI dumps → high effort, no citations, no schedule",
    "Page monitors → alert fatigue; team mutes the channel",
  ],
  wedge: [
    "Surface: Slack-first (+ thin dashboard)",
    "ICP: B2B SaaS, Series A–C, Slack-native GTM",
    "Outcome: weekday material-change digest with citations",
    "Gate: human approves battlecard publish",
  ],
} as const;

export const architectureLayers = [
  {
    name: "Slack / thin dashboard",
    owns: "Primary UX: /compete commands, digests, HITL buttons, upgrade UI",
    package: "worker + agent",
  },
  {
    name: "Agent layer (Eve-shaped)",
    owns: "Tools, skills, digest formatting, grounded Q&A, battlecard HITL policy",
    package: "@competepulse/agent",
  },
  {
    name: "Crawl factory (Cloudflare)",
    owns: "Hono API, Queues, retries, D1 metadata, R2 snapshots, Browser Run fallback, cron digests",
    package: "@competepulse/worker",
  },
  {
    name: "Domain + evals (core)",
    owns: "Schemas, plan limits, diffPricing/diffChangelog, precision gate",
    package: "@competepulse/core",
  },
  {
    name: "External providers",
    owns: "Firecrawl scrape/extract · Dodo billing · (planned) Vectorize semantic diff",
    package: "APIs",
  },
] as const;

export const pipelineSteps = [
  {
    step: 1,
    title: "Watch",
    detail:
      "User runs /compete watch add <url> [label]. Workspace + watch persist in D1. Hostname becomes competitor name when omitted.",
  },
  {
    step: 2,
    title: "Enqueue crawl",
    detail:
      "Cron, crawl_now tool, or HTTP POST enqueues a job on Cloudflare Queues (in-memory queue locally).",
  },
  {
    step: 3,
    title: "Scrape + extract",
    detail:
      "Firecrawl scrape with pricing/changelog JSON schema. Thin or blocked pages fall back to Browser Run. Mock fixtures when FIRECRAWL_API_KEY is unset.",
  },
  {
    step: 4,
    title: "Snapshot",
    detail:
      "Markdown + extracted JSON + content hash written to R2. Immutable history is the long-term moat.",
  },
  {
    step: 5,
    title: "Materiality diff",
    detail:
      "diffPricing / diffChangelog compare previous → current. Labels: high | low | none. Prefer silence over noise.",
  },
  {
    step: 6,
    title: "Digest / Q&A / HITL",
    detail:
      "Weekday digest (idempotent per workspace/day). /compete ask answers only from snapshots with citations. draft_battlecard stays parked until Approve.",
  },
] as const;

export interface StackChoice {
  id: string;
  layer: string;
  choice: string;
  why: string;
  against: string;
  rejected: string;
  interviewLine: string;
}

export const stackChoices: StackChoice[] = [
  {
    id: "eve-agent",
    layer: "Agent UX",
    choice: "Eve-shaped agent package (tools + skills + instructions)",
    why: "Durable Slack coworker model: tools as functions, skills as policy, HITL as first-class. Separates conversation semantics from crawl COGS.",
    against:
      "Adds an abstraction boundary. If Eve/Vercel agent hosting isn't live yet, the worker still wires tools — agent package is the contract.",
    rejected: "Free-form ChatGPT paste with no memory, schedule, or audit trail",
    interviewLine:
      "We treat the agent as a policy surface — citations required, materiality over completeness, never auto-publish battlecards — not as an unbounded LLM.",
  },
  {
    id: "cloudflare",
    layer: "Crawl ops",
    choice: "Cloudflare Workers + Queues + R2 + D1",
    why: "Cheap fan-out, retries, immutable object history, SQL for watches/workspaces, cron for digests — one vendor for the crawl factory.",
    against: "D1/Workers constraints (CPU time, SQL surface). Complex analytics may outgrow D1 later.",
    rejected: "Single Next.js cron scrapers (no durable queue/HITL split); always-on Browser Run (COGS)",
    interviewLine:
      "Responsibility split is non-negotiable: Cloudflare owns jobs and history; the agent owns Slack UX and HITL.",
  },
  {
    id: "firecrawl",
    layer: "Scrape",
    choice: "Firecrawl (primary) + Browser Run (fallback)",
    why: "LLM-ready markdown/JSON with extract schemas beats brittle Cheerio selectors on SaaS marketing sites.",
    against: "Vendor cost and dependency; need caps + fallback when scrape is thin/blocked.",
    rejected: "Raw HTML diffs (noise); Browser Run for every URL (expensive)",
    interviewLine:
      "Quality path first, expensive path only on failure — that's how we protect margin while keeping coverage.",
  },
  {
    id: "materiality",
    layer: "Classifier",
    choice: "Deterministic diffPricing in @competepulse/core + eval harness",
    why: "Precision is the product. Auditable rules + 20 golden human labels beat opaque LLM 'is this important?' every time for v1.",
    against: "Rules miss novel change types; later Vectorize/LLM assist can extend, not replace, the gate.",
    rejected: "Pixel/DOM monitors; un-evaluated LLM summaries as the alert decision",
    interviewLine:
      "We ship behind an ≥85% precision gate on human-labeled fixtures. False positives mute Slack channels — so precision beats recall.",
  },
  {
    id: "slack",
    layer: "Distribution",
    choice: "Slack slash commands + Block Kit HITL",
    why: "GTM already lives in Slack. Meet the workflow; don't invent another CI CMS.",
    against: "Slack API quirks, install friction, Teams users wait for Phase 3.",
    rejected: "Dashboard-only competitive intel (fails the wedge)",
    interviewLine:
      "The whole product is one morning message. Digests may auto-post; battlecards never publish without a human.",
  },
  {
    id: "dodo",
    layer: "Billing",
    choice: "Dodo Payments (MoR) — Starter $149 / Pro $399",
    why: "Merchant of Record for India + international without standing up full Stripe tax/compliance early.",
    against: "Less ubiquitous than Stripe; webhook/product mapping is custom.",
    rejected: "Stripe-only from day one (PRD original); manual invoicing forever",
    interviewLine:
      "PRD said Stripe; we shipped Dodo because MoR fit our go-to-market geography and solo-founder ops better — and I can explain the webhook state machine.",
  },
  {
    id: "astro",
    layer: "Marketing",
    choice: "Static Astro landing",
    why: "One CTA (Calendly). Kilobytes of HTML, no framework tax, matches 'morning briefing' editorial brand.",
    against: "Not an app shell — by design. Product UI stays on the Worker dashboard.",
    rejected: "Heavy marketing SPA",
    interviewLine:
      "Landing optimizes for booked discovery calls; the Worker owns the product. Clear separation of GTM vs system of record.",
  },
  {
    id: "monorepo",
    layer: "Repo",
    choice: "pnpm workspace: core / agent / worker / landing",
    why: "Shared types and classifier; independent deploy targets; eval lives next to the code it gates.",
    against: "More package plumbing than a single app.",
    rejected: "Copy-pasted types across services",
    interviewLine:
      "core is the shared brain — if materiality changes, agent digests and worker crawls both inherit it.",
  },
];

export const packages = [
  {
    name: "@competepulse/core",
    blurb: "Types, schemas, plan limits, materiality diffs, eval fixtures + precision gate",
  },
  {
    name: "@competepulse/worker",
    blurb: "Hono on CF Workers: watches, crawl, Slack, digests, dashboard, Dodo billing",
  },
  {
    name: "@competepulse/agent",
    blurb: "Tools, /compete parser, digest Block Kit, Q&A, HITL battlecards, skills, instructions",
  },
  {
    name: "@competepulse/landing",
    blurb: "Astro static marketing + Calendly; this interview brief lives here at /interview",
  },
] as const;

export const qualityStory = {
  thesis:
    "We don't vibe-check the agent. We score the alert decision against human judgment before shipping.",
  steps: [
    "Human rubric (Appendix B): high = price/plan/enterprise feature; low = minor/trial; none = noise",
    "20 golden fixtures: before/after extracted snapshots + expected label",
    "Classifier runs offline: precision = TP/(TP+FP) where positive = predicted high",
    "CI job pnpm eval — fail if fixtures < 20 or precision < 85%",
    "Runtime second gate: battlecard Approve/Reject in Slack (HITL)",
  ],
  example: {
    name: "acme-pro-price-hike",
    human: "Pro $99 → $129 is high — sales needs this",
    system: "diffPricing returns materiality: high + citation URL",
    counter: "acme-dark-mode expects low — must not inflate to high (that would be an FP)",
  },
} as const;

export type DrillCategory = "product" | "architecture" | "systems" | "behavioral";

export interface DrillItem {
  id: string;
  category: DrillCategory;
  question: string;
  /** Answer you should be able to say out loud. */
  answer: string;
  /** Optional follow-up the interviewer might ask. */
  followUp?: string;
}

export const drills: DrillItem[] = [
  {
    id: "what-is-it",
    category: "product",
    question: "What does CompetePulse do?",
    answer:
      "It's a Slack-native competitive change agent. Customers watch competitor URLs; we crawl, extract structured facts, keep only material changes, and post a cited weekday digest. Humans approve before battlecards publish.",
    followUp: "Who is the ICP and why Slack-first?",
  },
  {
    id: "vs-klue",
    category: "product",
    question: "How is this different from Klue/Crayon or Visualping?",
    answer:
      "Klue/Crayon are enterprise CI suites — expensive, need a CI owner, battlecard CMS. Visualping is cheap but noisy (CSS/footer). We sell a coworker in Slack: material digests with citations, minutes to set up, mid-market price via Dodo Starter/Pro.",
  },
  {
    id: "architecture",
    category: "architecture",
    question: "Walk me through the architecture.",
    answer:
      "Four packages: core (classifier + evals), agent (tools/skills/Slack semantics), worker (CF crawl factory + API + billing), landing (GTM). External: Firecrawl, Browser Run fallback, Dodo. Slack and a thin dashboard are the surfaces. Agent never owns crawl storage; Worker never owns HITL policy.",
  },
  {
    id: "pipeline",
    category: "architecture",
    question: "What happens when a pricing page changes?",
    answer:
      "Watch is crawled via Queue → Firecrawl extract (or Browser fallback) → R2 snapshot + hash → diffPricing vs previous → ChangeEvent with materiality → weekday digest includes it if high/low per quiet mode → optional battlecard draft waiting on Approve.",
  },
  {
    id: "why-cf",
    category: "systems",
    question: "Why Cloudflare instead of a Node server on a VM?",
    answer:
      "Crawl fan-out wants queues, retries, and cheap object storage next to the worker. Workers + Queues + R2 + D1 + cron match that job. We keep LLM/agent concerns separable so crawl COGS and conversation durability don't share a failure domain.",
  },
  {
    id: "why-not-llm-diff",
    category: "systems",
    question: "Why not just ask an LLM if the page changed meaningfully?",
    answer:
      "v1 uses deterministic diffs on structured extracts plus a human-labeled precision gate. LLMs drift, cost money per page, and are hard to CI-gate. We can add semantic assist later (Vectorize) behind the same precision metric — not instead of it.",
  },
  {
    id: "evals",
    category: "systems",
    question: "How do you know quality is good enough to ship?",
    answer:
      "20 golden before/after fixtures with human expected labels. pnpm eval scores precision on high predictions; CI fails below 85%. That's the pre-ship gate. Runtime HITL is a second gate for publishable copy.",
  },
  {
    id: "failure-modes",
    category: "systems",
    question: "What are the main failure modes and mitigations?",
    answer:
      "Digest noise → churn: materiality rubric + quiet mode + evals. Crawl COGS: plan caps, Browser only on fallback, usage meter. Scrape blocks: Browser Run. Over-alerting: precision gate biased to silence when unsure.",
  },
  {
    id: "scale",
    category: "architecture",
    question: "How would you scale this to 1,000 workspaces?",
    answer:
      "Hard crawl caps per plan, queue concurrency limits, snapshot lifecycle policies on R2, move hot metadata if D1 becomes limiting, keep eval gate before raising crawl volume (PRD: evals before growth). Multi-tenant isolation by workspace_id everywhere.",
  },
  {
    id: "ownership",
    category: "behavioral",
    question: "What did you personally own on this project?",
    answer:
      "Fill this in on the Your story section — interviewers want specifics: epics you drove (E0–E5), decisions you made (Dodo vs Stripe, deterministic classifier), and a metric (eval precision, digests, pilots).",
    followUp: "Tell me about a hard tradeoff you made.",
  },
  {
    id: "tradeoff",
    category: "behavioral",
    question: "Tell me about a technical tradeoff you made.",
    answer:
      "Strong example: deterministic materiality vs LLM judgment for v1 — chose auditable precision and CI gating over flexible language understanding; accepted weaker coverage of novel change types. Or: Dodo MoR vs Stripe ubiquity for founder ops + India/international.",
  },
  {
    id: "security",
    category: "systems",
    question: "How do you think about security and tenancy?",
    answer:
      "Slack signing secret verification when configured; workspace-scoped watches/changes; secrets in Wrangler/.dev.vars never committed; CI secrets:check; plan caps prevent abuse of crawl budget; battlecards require HITL so the bot can't silently publish wrong enablement copy.",
  },
];

export const checkTopics = [
  { id: "pitch", label: "I can deliver the 30s and 2min pitch cold" },
  { id: "arch-diagram", label: "I can draw the architecture on a whiteboard" },
  { id: "pipeline", label: "I can narrate crawl → snapshot → diff → digest" },
  { id: "tradeoffs", label: "I can defend CF / Firecrawl / deterministic diffs / Dodo" },
  { id: "eval", label: "I can explain the 85% precision gate with a concrete fixture" },
  { id: "story", label: "I filled Your story with my real ownership bullets" },
] as const;

/**
 * YOUR INPUT — interviewers hire for ownership. Replace the placeholders with
 * real work you did. Keep bullets concrete (file/epic + outcome).
 */
export const yourStoryTemplate = {
  rolePrompt:
    "In packages/landing/src/interview/content.ts → yourStory, replace each TODO with 1–2 sentences only you can say.",
  bullets: [
    {
      id: "owned",
      prompt: "What you owned (epics, packages, decisions)",
      placeholder: "TODO: e.g. Owned E2 crawl pipeline + E5 eval gate in core/worker…",
    },
    {
      id: "hardest",
      prompt: "Hardest bug or design call",
      placeholder: "TODO: e.g. Thin-scrape fallback vs always-Browser — chose… because…",
    },
    {
      id: "metric",
      prompt: "Proof / metric you'd put on a résumé line",
      placeholder: "TODO: e.g. 20-fixture eval at 100% precision in CI; Phase 1 E0–E5 shipped…",
    },
    {
      id: "next",
      prompt: "What you'd build next and why",
      placeholder: "TODO: e.g. Human tp/fp labels on live ChangeEvents feeding the same gate…",
    },
  ],
} as const;

/** Mutable story fields — edit these before the interview. */
export const yourStory = {
  owned: "TODO: What you owned (epics, packages, decisions).",
  hardest: "TODO: Hardest bug or design call — situation, options, choice, result.",
  metric: "TODO: One résumé-ready metric or shipped outcome.",
  next: "TODO: What you'd build next and why it compounds the moat.",
} as const;
