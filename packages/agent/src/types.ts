import type { ChangeEvent, WatchLabel } from "@competepulse/core";

export interface WatchInput {
  competitor: string;
  url: string;
  label: WatchLabel;
  workspaceId?: string;
}

export interface Watch extends WatchInput {
  id: string;
  workspaceId: string;
  createdAt: string;
}

export interface StoredChange extends ChangeEvent {
  id: string;
  watchId: string;
  createdAt: string;
}

export type BattlecardStatus = "draft" | "approved" | "rejected";

export interface BattlecardDraft {
  id: string;
  workspaceId: string;
  changeId: string;
  body: string;
  status: BattlecardStatus;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface DigestDelivery {
  id: string;
  workspaceId: string;
  /** Calendar day key `YYYY-MM-DD` (UTC) used for idempotency. */
  deliveryDate: string;
  body: string;
  createdAt: string;
}
