import type { DigestDelivery, MemoryStore, StoredChange } from "./store.js";

export interface DigestRunResult {
  delivered: boolean;
  skipped: boolean;
  deliveryDate: string;
  body: string;
  delivery?: DigestDelivery;
}

/**
 * Idempotent weekday digest for one workspace (PRD E1-4).
 * Kept in the worker so the cron trigger does not need a separate process.
 */
export function runWorkspaceDigest(
  data: MemoryStore,
  workspaceId: string,
  now: Date = new Date(),
): DigestRunResult {
  const deliveryDate = utcDateKey(now);

  if (isWeekendUtc(now)) {
    return {
      delivered: false,
      skipped: true,
      deliveryDate,
      body: "Weekend — digest schedule idle.",
    };
  }

  const existing = data.getDigestDelivery(workspaceId, deliveryDate);
  if (existing) {
    return {
      delivered: false,
      skipped: true,
      deliveryDate,
      body: existing.body,
      delivery: existing,
    };
  }

  const watches = data.listWatches(workspaceId);
  const sections: string[] = [];
  for (const watch of watches) {
    const changes = data.listChanges(watch.id);
    const todays = changes.filter((c) => c.createdAt.slice(0, 10) === deliveryDate);
    sections.push(formatDigest(watch.competitor, todays));
  }

  const body =
    sections.length === 0
      ? "*CompetePulse digest*: No watches configured."
      : [`*CompetePulse digest* — ${deliveryDate}`, "", ...sections].join("\n");

  const delivery = data.saveDigestDelivery({ workspaceId, deliveryDate, body });
  return { delivered: true, skipped: false, deliveryDate, body, delivery };
}

export function runAllWorkspaceDigests(
  data: MemoryStore,
  now: Date = new Date(),
): DigestRunResult[] {
  return data.listWorkspaces().map((ws) => runWorkspaceDigest(data, ws.id, now));
}

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWeekendUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function formatDigest(competitor: string, changes: StoredChange[]): string {
  const material = changes.filter((c) => c.materiality !== "none");
  if (material.length === 0) {
    return `*${competitor}*: All quiet - no material changes.`;
  }
  const rank = (label: string) => (label === "high" ? 2 : label === "low" ? 1 : 0);
  const lines = material
    .sort((a, b) => rank(b.materiality) - rank(a.materiality))
    .map(
      (c) =>
        `${c.materiality === "high" ? "[HIGH]" : "[LOW]"} ${c.summary} (${c.citations[0] ?? ""})`,
    );
  return [`*${competitor}* - ${material.length} material change(s):`, ...lines].join("\n");
}
