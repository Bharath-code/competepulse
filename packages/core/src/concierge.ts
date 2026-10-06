export interface Deal {
  name: string;
  owner_email: string;
  stage: string;
  amount: number | null;
  competitor: string;
}

export interface ConciergeChange {
  rival: string;
  summary: string;
  findings: { summary: string }[];
  citations: string[];
}

const CLOSED = /^(closed|won|lost)|closed[\s_-]?(won|lost)/i;

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  const [head = [], ...body] = rows;
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export function toDeals(rows: Record<string, string>[]): Deal[] {
  return rows.map((r) => {
    const amount = Number((r.amount ?? "").replace(/[^0-9.]/g, ""));
    return {
      name: r.name ?? "",
      owner_email: (r.owner_email ?? "").toLowerCase(),
      stage: r.stage ?? "",
      amount: r.amount && Number.isFinite(amount) ? amount : null,
      competitor: r.competitor ?? "",
    };
  });
}

export function matchDeals(deals: Deal[], rival: string): Deal[] {
  const want = rival.trim().toLowerCase();
  return deals.filter(
    (d) =>
      !CLOSED.test(d.stage) &&
      d.competitor.split(/[;,|]/).some((c) => c.trim().toLowerCase() === want),
  );
}

// Talk-track v0: cite the change, one paragraph, one line to say. Edit before sending.
export function suggestedLine(change: ConciergeChange): string {
  const top = change.findings[0]?.summary ?? change.summary;
  return `"Worth knowing: ${change.rival} just changed — ${top.replace(/\.$/, "")}. Happy to compare how that plays out for your setup."`;
}

export function renderDms(deals: Deal[], change: ConciergeChange): string {
  const byOwner = new Map<string, Deal[]>();
  for (const d of deals) byOwner.set(d.owner_email, [...(byOwner.get(d.owner_email) ?? []), d]);
  const source = change.citations[0] ?? "(no link)";
  const money = (n: number | null) => (n === null ? "" : ` ($${n.toLocaleString("en-US")})`);
  return [...byOwner.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([owner, ds]) =>
      [
        `## To: ${owner || "(no owner)"}`,
        `**${change.rival} changed:** ${change.summary}`,
        `Source: ${source}`,
        "",
        `Open deals against ${change.rival}:`,
        ...ds.map((d) => `- ${d.name}${money(d.amount)} · ${d.stage}`),
        "",
        `Say this: ${suggestedLine(change)}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

export function logRows(deals: Deal[], changeId: string, at: string): string {
  return deals
    .map((d) =>
      [d.name, d.owner_email, changeId, at, "", "", ""]
        .map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
        .join(","),
    )
    .join("\n");
}

export const LOG_HEADER = "deal,owner_email,change_id,sent_at,reply,outcome,notes";
