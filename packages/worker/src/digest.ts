import { formatDigestBlocks, type QuietMode } from "@competepulse/agent";
import type { DigestDelivery, MemoryStore } from "./store.js";

export interface DigestRunResult {
  delivered: boolean;
  skipped: boolean;
  deliveryDate: string;
  body: string;
  blocks?: unknown[];
  delivery?: DigestDelivery;
}

/**
 * Idempotent weekday digest for one workspace (PRD E1-4 / E3-1 / E3-2).
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
      blocks: existing.blocksJson ? (JSON.parse(existing.blocksJson) as unknown[]) : undefined,
      delivery: existing,
    };
  }

  const workspace = data.getWorkspace(workspaceId);
  const quietMode: QuietMode = workspace?.quietMode ?? "all_quiet";
  const watches = data.listWatches(workspaceId);

  if (watches.length === 0) {
    const body = "*CompetePulse digest*: No watches configured.";
    const delivery = data.saveDigestDelivery({ workspaceId, deliveryDate, body });
    return { delivered: true, skipped: false, deliveryDate, body, delivery };
  }

  const sections = watches.map((watch) => {
    const changes = data.listChanges(watch.id);
    const todays = changes.filter((c) => c.createdAt.slice(0, 10) === deliveryDate);
    return { competitor: watch.competitor, changes: todays };
  });

  const formatted = formatDigestBlocks(sections, { date: deliveryDate, quietMode });
  if (formatted.allQuiet && quietMode === "skip") {
    return { delivered: false, skipped: true, deliveryDate, body: "", blocks: [] };
  }

  const delivery = data.saveDigestDelivery({
    workspaceId,
    deliveryDate,
    body: formatted.text,
    blocksJson: JSON.stringify(formatted.blocks),
  });

  return {
    delivered: true,
    skipped: false,
    deliveryDate,
    body: formatted.text,
    blocks: formatted.blocks,
    delivery,
  };
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
