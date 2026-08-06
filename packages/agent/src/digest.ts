import type { StoredChange } from "./types.js";

export type QuietMode = "all_quiet" | "skip";

export interface DigestSection {
  competitor: string;
  changes: StoredChange[];
}

export interface FormattedDigest {
  /** Plain mrkdwn fallback text for notifications / storage. */
  text: string;
  /** Slack Block Kit blocks (E3-1). */
  blocks: unknown[];
  /** True when every section had zero material changes. */
  allQuiet: boolean;
}

const MATERIALITY_TAG: Record<string, string> = {
  high: "[HIGH]",
  low: "[LOW]",
  none: "[none]",
};

function rank(label: string): number {
  return label === "high" ? 2 : label === "low" ? 1 : 0;
}

function whyItMatters(change: StoredChange): string {
  if (change.materiality === "high") {
    if (change.findings.some((f) => f.kind === "price")) {
      return "Why it matters: price moves change deal math and talk tracks.";
    }
    if (change.findings.some((f) => f.kind.startsWith("plan_"))) {
      return "Why it matters: packaging shifts may open or close competitive wedges.";
    }
    return "Why it matters: enterprise or messaging shifts can stale battlecards quickly.";
  }
  return "Why it matters: minor, but worth a glance before the next enablement pass.";
}

/**
 * Format a single competitor section as Slack blocks: competitor, change,
 * cite link, and “why it matters” ≤2 lines (PRD E3-1).
 */
export function formatCompetitorBlocks(competitor: string, changes: StoredChange[]): unknown[] {
  const material = changes
    .filter((c) => c.materiality !== "none")
    .sort((a, b) => rank(b.materiality) - rank(a.materiality));

  if (material.length === 0) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${competitor}*: All quiet — no material changes.`,
        },
      },
    ];
  }

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: competitor, emoji: false },
    },
  ];

  for (const change of material) {
    const cite = change.citations[0] ?? "";
    const why = whyItMatters(change);
    const whyLines = why.split("\n").slice(0, 2).join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `${MATERIALITY_TAG[change.materiality] ?? ""} ${change.summary}`,
          cite ? `Cite: <${cite}|source>` : null,
          whyLines,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  return blocks;
}

/**
 * Format a weekday digest. Quiet mode (E3-2):
 * - `all_quiet` → single “All quiet” line when nothing material
 * - `skip` → empty text + allQuiet so the scheduler can skip delivery
 */
export function formatDigestBlocks(
  sections: DigestSection[],
  options: { date?: string; quietMode?: QuietMode } = {},
): FormattedDigest {
  const quietMode = options.quietMode ?? "all_quiet";
  const date = options.date ?? new Date().toISOString().slice(0, 10);

  const materialSections = sections.filter((s) => s.changes.some((c) => c.materiality !== "none"));
  const allQuiet = materialSections.length === 0;

  if (allQuiet) {
    if (quietMode === "skip") {
      return { text: "", blocks: [], allQuiet: true };
    }
    const text = "*CompetePulse digest*: All quiet — no material changes.";
    return {
      text,
      allQuiet: true,
      blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
    };
  }

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `CompetePulse digest — ${date}`, emoji: false },
    },
  ];
  const textParts: string[] = [`*CompetePulse digest* — ${date}`, ""];

  for (const section of sections) {
    blocks.push(...formatCompetitorBlocks(section.competitor, section.changes));
    blocks.push({ type: "divider" });
    textParts.push(formatDigest(section.competitor, section.changes));
  }

  return { text: textParts.join("\n"), blocks, allQuiet: false };
}

/**
 * Plain-text digest formatter (back-compat for tests / storage fallback).
 * Emits the "all quiet" single line when nothing material changed (E3-2).
 */
export function formatDigest(competitor: string, changes: StoredChange[]): string {
  const material = changes.filter((c) => c.materiality !== "none");
  if (material.length === 0) {
    return `*${competitor}*: All quiet - no material changes.`;
  }

  const lines = material
    .sort((a, b) => rank(b.materiality) - rank(a.materiality))
    .map((c) => {
      const cite = c.citations[0] ?? "";
      const why = whyItMatters(c);
      return `${MATERIALITY_TAG[c.materiality] ?? ""} ${c.summary} (${cite})\n${why}`;
    });

  return [`*${competitor}* - ${material.length} material change(s):`, ...lines].join("\n");
}
