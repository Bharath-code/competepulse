import type { CompetePulseClient } from "./client.js";
import type { BattlecardDraft, StoredChange, Watch, WatchInput } from "./types.js";

/**
 * Eve agent tool implementations (PRD §12 "Tool files"). Each tool is a thin,
 * testable function over the {@link CompetePulseClient} transport.
 */

/** `watch_add` — add a competitor URL + label. */
export function watchAdd(client: CompetePulseClient, input: WatchInput): Promise<Watch> {
  return client.addWatch(input);
}

/** `watch_list` — list current watches (optionally scoped to a workspace). */
export function watchList(client: CompetePulseClient, workspaceId?: string): Promise<Watch[]> {
  return client.listWatches(workspaceId);
}

/** `watch_remove` — remove a watch by id. */
export function watchRemove(
  client: CompetePulseClient,
  id: string,
  workspaceId?: string,
): Promise<boolean> {
  return client.removeWatch(id, workspaceId);
}

/** `crawl_now` — enqueue an immediate crawl and return the change event. */
export function crawlNow(client: CompetePulseClient, watchId: string): Promise<StoredChange> {
  return client.crawl(watchId);
}

/** `get_changes` — query material changes for a watch. */
export function getChanges(client: CompetePulseClient, watchId: string): Promise<StoredChange[]> {
  return client.getChanges(watchId);
}

/**
 * `draft_battlecard` — draft a snippet from a change event. Per PRD Product
 * Principle 4 the draft is never auto-published; it stays `status: "draft"`
 * until a human approves (HITL).
 */
export function draftBattlecard(
  change: StoredChange,
  workspaceId: string,
  id: string = crypto.randomUUID(),
): BattlecardDraft {
  const cites = change.citations.map((c) => `- ${c}`).join("\n");
  const body = [
    `*Competitive update* (${change.materiality.toUpperCase()})`,
    "",
    change.summary,
    "",
    "Sources:",
    cites,
  ].join("\n");
  return {
    id,
    workspaceId,
    status: "draft",
    changeId: change.id,
    body,
    createdAt: new Date().toISOString(),
  };
}

/**
 * HITL approve — only transitions `draft` → `approved`. Already decided
 * drafts are left unchanged (idempotent park/resume). Approval does **not**
 * post to the channel; call {@link publishBattlecard} after approve (E3-4).
 */
export function approveBattlecard(draft: BattlecardDraft, approvedBy: string): BattlecardDraft {
  if (draft.status !== "draft") return draft;
  return {
    ...draft,
    status: "approved",
    approvedBy,
    approvedAt: new Date().toISOString(),
  };
}

/**
 * Publish an approved battlecard (pin/post). Drafts and rejected cards cannot
 * be published — HITL gate is mandatory (E3-4).
 */
export function publishBattlecard(draft: BattlecardDraft): BattlecardDraft {
  if (draft.status !== "approved") {
    throw new Error("Cannot publish battlecard without HITL approval.");
  }
  if (draft.publishedAt) return draft;
  return { ...draft, publishedAt: new Date().toISOString() };
}

/**
 * HITL reject — only transitions `draft` → `rejected`.
 */
export function rejectBattlecard(draft: BattlecardDraft, rejectedBy: string): BattlecardDraft {
  if (draft.status !== "draft") return draft;
  return {
    ...draft,
    status: "rejected",
    approvedBy: rejectedBy,
    approvedAt: new Date().toISOString(),
  };
}

/** Slack Block Kit actions for a parked battlecard draft (PRD E1-5). */
export function battlecardActionBlocks(draft: BattlecardDraft): unknown[] {
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: draft.body },
    },
    {
      type: "actions",
      block_id: `battlecard:${draft.id}`,
      elements: [
        {
          type: "button",
          action_id: "battlecard_approve",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          value: draft.id,
        },
        {
          type: "button",
          action_id: "battlecard_reject",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          value: draft.id,
        },
      ],
    },
  ];
}
