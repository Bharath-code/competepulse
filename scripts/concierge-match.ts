// Usage: node scripts/concierge-match.ts <deals.csv> <change-id|change.json> [--log]
// <change-id> is read from remote D1 via wrangler; <change.json> = {rival,summary,findings,citations}.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import {
  LOG_HEADER,
  logRows,
  matchDeals,
  parseCsv,
  renderDms,
  toDeals,
} from "../packages/core/src/concierge.ts";
import type { ConciergeChange } from "../packages/core/src/concierge.ts";

const [csvPath, changeArg, flag] = process.argv.slice(2);
if (!csvPath || !changeArg) {
  console.error("usage: concierge-match.ts <deals.csv> <change-id|change.json> [--log]");
  process.exit(1);
}

function loadChange(arg: string): ConciergeChange {
  if (existsSync(arg)) return JSON.parse(readFileSync(arg, "utf8"));
  if (!/^[\w-]+$/.test(arg)) throw new Error("change id must be [A-Za-z0-9_-]");
  const sql = `SELECT c.summary, c.findings_json, c.citations_json, w.competitor AS rival FROM change_events c JOIN watches w ON w.id = c.watch_id WHERE c.id = '${arg}'`;
  const out = execFileSync(
    "pnpm",
    [
      "--filter",
      "@competepulse/worker",
      "exec",
      "wrangler",
      "d1",
      "execute",
      "competepulse",
      "--remote",
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8" },
  );
  const row = JSON.parse(out)[0]?.results?.[0];
  if (!row) throw new Error(`change_event ${arg} not found`);
  return {
    rival: row.rival,
    summary: row.summary,
    findings: JSON.parse(row.findings_json),
    citations: JSON.parse(row.citations_json),
  };
}

const change = loadChange(changeArg);
const deals = matchDeals(toDeals(parseCsv(readFileSync(csvPath, "utf8"))), change.rival);
console.log(deals.length ? renderDms(deals, change) : `No open deals against ${change.rival}.`);
console.error(
  `\n${deals.length} deal(s), ${new Set(deals.map((d) => d.owner_email)).size} owner(s)`,
);

if (flag === "--log" && deals.length) {
  const log = "docs/data/concierge-log.csv";
  mkdirSync("docs/data", { recursive: true });
  if (!existsSync(log)) appendFileSync(log, LOG_HEADER + "\n");
  appendFileSync(log, logRows(deals, changeArg, new Date().toISOString()) + "\n");
  console.error(`logged → ${log}`);
}
