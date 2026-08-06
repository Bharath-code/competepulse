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

/** `watch_list` — list current watches. */
export function watchList(client: CompetePulseClient): Promise<Watch[]> {
  return client.listWatches();
}

/** `watch_remove` — remove a watch by id. */
export function watchRemove(client: CompetePulseClient, id: string): Promise<boolean> {
  return client.removeWatch(id);
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
export function draftBattlecard(change: StoredChange): BattlecardDraft {
  const cites = change.citations.map((c) => `- ${c}`).join("\n");
  const body = [
    `*Competitive update* (${change.materiality.toUpperCase()})`,
    "",
    change.summary,
    "",
    "Sources:",
    cites,
  ].join("\n");
  return { status: "draft", changeId: change.id, body };
}
