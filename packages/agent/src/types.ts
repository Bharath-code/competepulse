import type { ChangeEvent, WatchLabel } from "@competepulse/core";

export interface WatchInput {
  competitor: string;
  url: string;
  label: WatchLabel;
}

export interface Watch extends WatchInput {
  id: string;
  createdAt: string;
}

export interface StoredChange extends ChangeEvent {
  id: string;
  watchId: string;
  createdAt: string;
}

export interface BattlecardDraft {
  status: "draft";
  changeId: string;
  body: string;
}
