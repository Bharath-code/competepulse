import { formatDigestBlocks, type QuietMode } from "@competepulse/agent";
import type { DigestDelivery, Store } from "./store.js";

export interface DigestRunResult {
  delivered: boolean;
  skipped: boolean;
  deliveryDate: string;
  body: string;
  blocks?: unknown[];
  delivery?: DigestDelivery;
  /** Set when Slack post was attempted. */
  slackPosted?: boolean;
  slackError?: string;
}

/**
 * Idempotent weekday digest for one workspace (PRD E1-4 / E3-1 / E3-2).
 */
export async function runWorkspaceDigest(
  data: Store,
  workspaceId: string,
  now: Date = new Date(),
): Promise<DigestRunResult> {
  const deliveryDate = utcDateKey(now);

  if (isWeekendUtc(now)) {
    return {
      delivered: false,
      skipped: true,
      deliveryDate,
      body: "Weekend — digest schedule idle.",
    };
  }

  const existing = await data.getDigestDelivery(workspaceId, deliveryDate);
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

  const workspace = await data.getWorkspace(workspaceId);
  const quietMode: QuietMode = workspace?.quietMode ?? "all_quiet";
  const watches = await data.listWatches(workspaceId);

  if (watches.length === 0) {
    const body = "*CompetePulse digest*: No watches configured.";
    const delivery = await data.saveDigestDelivery({ workspaceId, deliveryDate, body });
    return { delivered: true, skipped: false, deliveryDate, body, delivery };
  }

  const sections = [];
  for (const watch of watches) {
    const changes = await data.listChanges(watch.id);
    const todays = changes.filter((c) => c.createdAt.slice(0, 10) === deliveryDate);
    sections.push({ competitor: watch.competitor, changes: todays });
  }

  const formatted = formatDigestBlocks(sections, { date: deliveryDate, quietMode });
  if (formatted.allQuiet && quietMode === "skip") {
    return { delivered: false, skipped: true, deliveryDate, body: "", blocks: [] };
  }

  const delivery = await data.saveDigestDelivery({
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

export async function runAllWorkspaceDigests(
  data: Store,
  now: Date = new Date(),
): Promise<DigestRunResult[]> {
  const workspaces = await data.listWorkspaces();
  const results: DigestRunResult[] = [];
  for (const ws of workspaces) {
    results.push(await runWorkspaceDigest(data, ws.id, now));
  }
  return results;
}

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWeekendUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}
