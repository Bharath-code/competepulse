import type { WatchLabel } from "@competepulse/core";
import type { CompetePulseClient } from "./client.js";
import { watchAdd, watchList, watchRemove } from "./tools.js";
import type { Watch } from "./types.js";

const WATCH_LABELS: WatchLabel[] = ["pricing", "changelog", "docs", "careers", "other"];

export type CompeteCommand =
  | { kind: "watch_add"; url: string; competitor?: string; label: WatchLabel }
  | { kind: "watch_list" }
  | { kind: "watch_remove"; id: string }
  | { kind: "help" }
  | { kind: "error"; message: string };

/**
 * Parse `/compete …` slash-command text (PRD E1-3).
 *
 * Accepted forms:
 * - `watch add <url> [label]`
 * - `watch add <competitor> <url> [label]`
 * - `watch list`
 * - `watch remove <id>`
 */
export function parseCompeteCommand(text: string): CompeteCommand {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { kind: "help" };

  const [head, sub, ...rest] = tokens;
  if (head !== "watch") {
    return {
      kind: "error",
      message: "Unknown command. Try `/compete watch add|list|remove`.",
    };
  }

  if (sub === "list") return { kind: "watch_list" };

  if (sub === "remove") {
    const id = rest[0];
    if (!id) return { kind: "error", message: "Usage: `/compete watch remove <id>`" };
    return { kind: "watch_remove", id };
  }

  if (sub === "add") {
    if (rest.length === 0) {
      return { kind: "error", message: "Usage: `/compete watch add <url> [label]`" };
    }
    const urlToken = rest.find((t) => looksLikeUrl(t));
    if (!urlToken) {
      return {
        kind: "error",
        message:
          "A URL is required. Example: `/compete watch add https://acme.example/pricing pricing`",
      };
    }
    const url = normalizeUrl(urlToken);
    const labelToken = rest.find((t): t is WatchLabel => t !== urlToken && isWatchLabel(t));
    const competitorToken = rest.find(
      (t) => t !== urlToken && t !== labelToken && !isWatchLabel(t),
    );
    return {
      kind: "watch_add",
      url,
      competitor: competitorToken,
      label: labelToken ?? guessLabel(url),
    };
  }

  return { kind: "help" };
}

export function helpText(): string {
  return [
    "*CompetePulse* commands:",
    "`/compete watch add <url> [label]` — start watching a competitor URL",
    "`/compete watch list` — list watches for this workspace",
    "`/compete watch remove <id>` — stop watching",
  ].join("\n");
}

/** Run a parsed `/compete` command against the worker client. */
export async function runCompeteCommand(
  client: CompetePulseClient,
  command: CompeteCommand,
  workspaceId: string,
): Promise<string> {
  switch (command.kind) {
    case "help":
      return helpText();
    case "error":
      return command.message;
    case "watch_list": {
      const watches = await watchList(client, workspaceId);
      if (watches.length === 0) return "No watches yet. Add one with `/compete watch add <url>`.";
      return ["Watches:", ...watches.map(formatWatchLine)].join("\n");
    }
    case "watch_remove": {
      const removed = await watchRemove(client, command.id, workspaceId);
      return removed ? `Removed watch \`${command.id}\`.` : `Watch \`${command.id}\` not found.`;
    }
    case "watch_add": {
      const competitor = command.competitor ?? competitorFromUrl(command.url);
      const watch = await watchAdd(client, {
        competitor,
        url: command.url,
        label: command.label,
        workspaceId,
      });
      return `Watching *${watch.competitor}* (\`${watch.label}\`) → ${watch.url}\nId: \`${watch.id}\``;
    }
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

function formatWatchLine(watch: Watch): string {
  return `• \`${watch.id}\` *${watch.competitor}* [${watch.label}] ${watch.url}`;
}

function looksLikeUrl(token: string): boolean {
  return /^https?:\/\//i.test(token) || /^[\w.-]+\.[\w.-]+(\/.*)?$/i.test(token);
}

function normalizeUrl(token: string): string {
  if (/^https?:\/\//i.test(token)) return token;
  return `https://${token}`;
}

function isWatchLabel(token: string): token is WatchLabel {
  return (WATCH_LABELS as string[]).includes(token);
}

function guessLabel(url: string): WatchLabel {
  const path = url.toLowerCase();
  if (path.includes("pricing") || path.includes("price")) return "pricing";
  if (path.includes("changelog") || path.includes("release")) return "changelog";
  if (path.includes("career") || path.includes("jobs")) return "careers";
  if (path.includes("doc")) return "docs";
  return "other";
}

export function competitorFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const stem = host.split(".")[0] ?? host;
    return stem.charAt(0).toUpperCase() + stem.slice(1);
  } catch {
    return "Competitor";
  }
}
