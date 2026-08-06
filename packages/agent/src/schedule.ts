import { formatDigest } from "./digest.js";
import type { DigestDelivery, StoredChange, Watch } from "./types.js";

export interface DigestScheduleStore {
  listWatches(workspaceId: string): Promise<Watch[]>;
  listChanges(watchId: string): Promise<StoredChange[]>;
  getDigestDelivery(workspaceId: string, deliveryDate: string): Promise<DigestDelivery | null>;
  saveDigestDelivery(
    delivery: Omit<DigestDelivery, "id" | "createdAt"> & { id?: string },
  ): Promise<DigestDelivery>;
}

export interface DigestRunResult {
  /** True when a new digest was produced and recorded. */
  delivered: boolean;
  /** True when a prior delivery for the same workspace/day already existed. */
  skipped: boolean;
  deliveryDate: string;
  body: string;
  delivery?: DigestDelivery;
}

/**
 * Build and record a weekday digest for one workspace.
 * Idempotent on `(workspaceId, deliveryDate)` — a second call the same UTC day
 * returns `skipped: true` without writing again (PRD E1-4).
 */
export async function runWeekdayDigest(
  store: DigestScheduleStore,
  workspaceId: string,
  options: { now?: Date; onlyWeekdays?: boolean } = {},
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

  const watches = await store.listWatches(workspaceId);
  const sections: string[] = [];
  for (const watch of watches) {
    const changes = await store.listChanges(watch.id);
    // Only include changes from this UTC day so digests stay day-scoped.
    const todays = changes.filter((c) => c.createdAt.slice(0, 10) === deliveryDate);
    sections.push(formatDigest(watch.competitor, todays));
  }

  const body =
    sections.length === 0
      ? "*CompetePulse digest*: No watches configured."
      : [`*CompetePulse digest* — ${deliveryDate}`, "", ...sections].join("\n");

  const delivery = await store.saveDigestDelivery({
    workspaceId,
    deliveryDate,
    body,
  });

  return { delivered: true, skipped: false, deliveryDate, body, delivery };
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
