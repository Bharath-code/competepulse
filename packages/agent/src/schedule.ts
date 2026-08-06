import { formatDigestBlocks, type QuietMode } from "./digest.js";
import type { DigestDelivery, StoredChange, Watch } from "./types.js";

export interface DigestScheduleStore {
  listWatches(workspaceId: string): Promise<Watch[]>;
  listChanges(watchId: string): Promise<StoredChange[]>;
  getDigestDelivery(workspaceId: string, deliveryDate: string): Promise<DigestDelivery | null>;
  saveDigestDelivery(
    delivery: Omit<DigestDelivery, "id" | "createdAt"> & { id?: string },
  ): Promise<DigestDelivery>;
  getQuietMode?(workspaceId: string): Promise<QuietMode>;
}

export interface DigestRunResult {
  /** True when a new digest was produced and recorded. */
  delivered: boolean;
  /** True when a prior delivery for the same workspace/day already existed, or quiet-skip. */
  skipped: boolean;
  deliveryDate: string;
  body: string;
  blocks?: unknown[];
  delivery?: DigestDelivery;
}

/**
 * Build and record a weekday digest for one workspace.
 * Idempotent on `(workspaceId, deliveryDate)` — a second call the same UTC day
 * returns `skipped: true` without writing again (PRD E1-4 / E3-2).
 */
export async function runWeekdayDigest(
  store: DigestScheduleStore,
  workspaceId: string,
  options: { now?: Date; onlyWeekdays?: boolean; quietMode?: QuietMode } = {},
): Promise<DigestRunResult> {
  const now = options.now ?? new Date();
  const onlyWeekdays = options.onlyWeekdays ?? true;
  const deliveryDate = utcDateKey(now);

  if (onlyWeekdays && isWeekendUtc(now)) {
    return {
      delivered: false,
      skipped: true,
      deliveryDate,
      body: "Weekend — digest schedule idle.",
    };
  }

  const existing = await store.getDigestDelivery(workspaceId, deliveryDate);
  if (existing) {
    return {
      delivered: false,
      skipped: true,
      deliveryDate,
      body: existing.body,
      delivery: existing,
    };
  }

  const quietMode =
    options.quietMode ?? (store.getQuietMode ? await store.getQuietMode(workspaceId) : "all_quiet");

  const watches = await store.listWatches(workspaceId);
  const sections = [];
  for (const watch of watches) {
    const changes = await store.listChanges(watch.id);
    const todays = changes.filter((c) => c.createdAt.slice(0, 10) === deliveryDate);
    sections.push({ competitor: watch.competitor, changes: todays });
  }

  if (sections.length === 0) {
    const body = "*CompetePulse digest*: No watches configured.";
    const delivery = await store.saveDigestDelivery({ workspaceId, deliveryDate, body });
    return { delivered: true, skipped: false, deliveryDate, body, delivery };
  }

  const formatted = formatDigestBlocks(sections, { date: deliveryDate, quietMode });
  if (formatted.allQuiet && quietMode === "skip") {
    return {
      delivered: false,
      skipped: true,
      deliveryDate,
      body: "",
      blocks: [],
    };
  }

  const delivery = await store.saveDigestDelivery({
    workspaceId,
    deliveryDate,
    body: formatted.text,
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

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWeekendUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Default weekday cron (Mon–Fri 13:00 UTC ≈ 08:00 US/Eastern standard). */
export const WEEKDAY_DIGEST_CRON = "0 13 * * 1-5";
