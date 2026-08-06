import type { StoredChange } from "./types.js";

export interface SnapshotGrounding {
  id: string;
  watchId: string;
  competitor?: string;
  url: string;
  summaryHints: string[];
  r2Key?: string;
  snapshotUrl?: string;
}

export interface QaAnswer {
  answer: string;
  citations: string[];
  grounded: boolean;
  refused: boolean;
}

/**
 * Thread Q&A grounded only in snapshots/changes (E3-3). Refuses to invent
 * facts that are not present in the grounding set; always includes URLs.
 */
export function answerFromSnapshots(
  question: string,
  grounding: { changes: StoredChange[]; snapshots?: SnapshotGrounding[] },
): QaAnswer {
  const q = question.toLowerCase();
  const citations = new Set<string>();
  const hits: string[] = [];

  for (const change of grounding.changes) {
    const haystack = [change.summary, ...change.findings.map((f) => f.summary)]
      .join(" ")
      .toLowerCase();
    const keywords = extractKeywords(q);
    const matched = keywords.some((kw) => haystack.includes(kw)) || materialityMatch(q, change);
    if (matched || keywords.length === 0) {
      hits.push(
        `• ${change.materiality.toUpperCase()}: ${change.summary}${
          change.citations[0] ? ` (${change.citations[0]})` : ""
        }`,
      );
      for (const c of change.citations) citations.add(c);
    }
  }

  for (const snap of grounding.snapshots ?? []) {
    const hay = [snap.url, ...(snap.summaryHints ?? [])].join(" ").toLowerCase();
    const keywords = extractKeywords(q);
    if (keywords.some((kw) => hay.includes(kw)) || q.includes("snapshot") || q.includes("source")) {
      const link = snap.snapshotUrl ?? snap.url;
      hits.push(
        `• Snapshot ${snap.id.slice(0, 8)}… for ${snap.competitor ?? "competitor"} → ${link}`,
      );
      citations.add(link);
      citations.add(snap.url);
    }
  }

  if (hits.length === 0) {
    return {
      answer:
        "I don't have that in our watched snapshots or change history. Add a URL with `/compete watch add` or ask about a recent digest change.",
      citations: [],
      grounded: false,
      refused: true,
    };
  }

  const citeList = [...citations];
  const answer = [
    "From our snapshots/change history:",
    ...hits.slice(0, 6),
    "",
    "Sources:",
    ...citeList.map((c) => `- ${c}`),
  ].join("\n");

  return { answer, citations: citeList, grounded: true, refused: false };
}

function extractKeywords(question: string): string[] {
  const stop = new Set([
    "what",
    "when",
    "where",
    "which",
    "who",
    "how",
    "did",
    "does",
    "the",
    "a",
    "an",
    "of",
    "on",
    "for",
    "to",
    "in",
    "is",
    "are",
    "was",
    "were",
    "about",
    "their",
    "our",
    "any",
    "change",
    "changes",
    "changed",
    "competitor",
    "competitors",
  ]);
  return question
    .toLowerCase()
    .split(/[^a-z0-9.$]+/)
    .filter((t) => t.length >= 3 && !stop.has(t));
}

function materialityMatch(q: string, change: StoredChange): boolean {
  if (q.includes("price") && change.findings.some((f) => f.kind === "price")) return true;
  if (q.includes("plan") && change.findings.some((f) => f.kind.startsWith("plan_"))) return true;
  if (q.includes("high") && change.materiality === "high") return true;
  if (q.includes("sso") && change.summary.toLowerCase().includes("sso")) return true;
  return false;
}
