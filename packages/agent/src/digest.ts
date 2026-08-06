import type { StoredChange } from "./types.js";

const MATERIALITY_TAG: Record<string, string> = {
  high: "[HIGH]",
  low: "[LOW]",
  none: "[none]",
};

/**
 * Format a weekday digest from a set of change events, following the
 * `digest_voice` skill: concise, cited, no hype. Emits the "all quiet"
 * single line when nothing material changed (PRD E3-2).
 */
export function formatDigest(competitor: string, changes: StoredChange[]): string {
  const material = changes.filter((c) => c.materiality !== "none");
  if (material.length === 0) {
    return `*${competitor}*: All quiet - no material changes.`;
  }

  const lines = material
    .sort((a, b) => rank(b.materiality) - rank(a.materiality))
    .map((c) => `${MATERIALITY_TAG[c.materiality] ?? ""} ${c.summary} (${c.citations[0] ?? ""})`);

  return [`*${competitor}* - ${material.length} material change(s):`, ...lines].join("\n");
}

function rank(label: string): number {
  return label === "high" ? 2 : label === "low" ? 1 : 0;
}
