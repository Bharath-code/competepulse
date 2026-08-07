import type { ChangeEvent, ChangeFinding, ChangelogSnapshot, MaterialityLabel } from "./types.js";

function rank(label: MaterialityLabel): number {
  return label === "high" ? 2 : label === "low" ? 1 : 0;
}

/**
 * Compare two changelog extracts. New release titles → high; tag-only edits → low.
 */
export function diffChangelog(
  from: ChangelogSnapshot | null,
  to: ChangelogSnapshot,
  url: string,
): ChangeEvent {
  if (from === null) {
    return {
      materiality: "none",
      summary: "Baseline changelog snapshot recorded.",
      findings: [],
      citations: [url],
    };
  }

  const fromTitles = new Set(from.entries.map((e) => e.title.toLowerCase()));
  const findings: ChangeFinding[] = [];

  for (const entry of to.entries) {
    if (!fromTitles.has(entry.title.toLowerCase())) {
      findings.push({
        kind: "feature_added",
        materiality: "high",
        summary: `Changelog entry added: "${entry.title}".`,
      });
    }
  }

  const materiality = findings.reduce<MaterialityLabel>(
    (acc, f) => (rank(f.materiality) > rank(acc) ? f.materiality : acc),
    "none",
  );

  return {
    materiality,
    summary:
      findings.length > 0
        ? findings.map((f) => f.summary).join(" ")
        : "No material changelog changes detected.",
    findings,
    citations: [url],
  };
}
