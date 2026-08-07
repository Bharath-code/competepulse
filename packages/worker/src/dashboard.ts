/**
 * Thin founder/PMM dashboard HTML (E4-2 / E4-3). Served from the Worker so we
 * avoid a separate frontend package for Phase 1. Stripe checkout is deferred.
 */

export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CompetePulse Dashboard</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a222c;
      --text: #e8eef4;
      --muted: #8b9aab;
      --accent: #3d9cf0;
      --high: #f07178;
      --low: #e6c07b;
      --ok: #7fd99a;
      --border: #2a3542;
      --font: "IBM Plex Sans", "Segoe UI", sans-serif;
      --mono: "IBM Plex Mono", ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font);
      background:
        radial-gradient(1200px 600px at 10% -10%, #1c3a55 0%, transparent 55%),
        radial-gradient(900px 500px at 100% 0%, #243028 0%, transparent 50%),
        var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    header {
      padding: 28px 32px 12px;
      border-bottom: 1px solid var(--border);
    }
    header h1 {
      margin: 0;
      font-size: 1.65rem;
      letter-spacing: -0.02em;
    }
    header p { margin: 6px 0 0; color: var(--muted); }
    main {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 20px;
      padding: 24px 32px 48px;
    }
    @media (max-width: 900px) {
      main { grid-template-columns: 1fr; padding: 16px; }
    }
    section {
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px 18px 8px;
    }
    section h2 {
      margin: 0 0 12px;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
      align-items: center;
    }
    select, button, input {
      background: #121820;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
    }
    button {
      background: var(--accent);
      border-color: transparent;
      color: #041018;
      font-weight: 600;
      cursor: pointer;
    }
    button.secondary { background: transparent; color: var(--text); border-color: var(--border); }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { color: var(--muted); font-weight: 500; }
    .tag {
      display: inline-block;
      font-family: var(--mono);
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: #243041;
    }
    .tag.high { background: color-mix(in srgb, var(--high) 25%, #243041); color: var(--high); }
    .tag.low { background: color-mix(in srgb, var(--low) 25%, #243041); color: var(--low); }
    .tag.none { color: var(--muted); }
    a { color: var(--accent); }
    .muted { color: var(--muted); }
    .meter { font-family: var(--mono); font-size: 0.85rem; }
    #detail {
      display: none;
      margin-top: 12px;
      padding: 12px;
      border: 1px dashed var(--border);
      border-radius: 8px;
      background: #121820;
    }
    #detail.visible { display: block; }
  </style>
</head>
<body>
  <header>
    <h1>CompetePulse</h1>
    <p>Watchlist + change history. Payments deferred — caps still enforced server-side.</p>
  </header>
  <main>
    <section>
      <h2>Watchlist</h2>
      <div class="toolbar">
        <label class="muted">Workspace
          <select id="workspace"></select>
        </label>
        <button id="refresh" class="secondary" type="button">Refresh</button>
      </div>
      <table>
        <thead>
          <tr><th>Competitor</th><th>Label</th><th>URL</th><th>Last crawl</th></tr>
        </thead>
        <tbody id="watches"></tbody>
      </table>
      <p class="meter muted" id="caps"></p>
    </section>
    <section>
      <h2>Change history</h2>
      <table>
        <thead>
          <tr><th>When</th><th>Materiality</th><th>Summary</th><th>Snapshot</th></tr>
        </thead>
        <tbody id="changes"></tbody>
      </table>
      <div id="detail"></div>
      <h2 style="margin-top:20px">Cost meter</h2>
      <p class="meter" id="usage">—</p>
    </section>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    let workspaces = [];
    let watches = [];

    async function api(path) {
      const res = await fetch(path);
      if (!res.ok) throw new Error(path + " " + res.status);
      return res.json();
    }

    function fmt(ts) {
      if (!ts) return "—";
      return ts.replace("T", " ").slice(0, 16) + "Z";
    }

    async function loadWorkspaces() {
      const data = await api("/workspaces");
      workspaces = data.workspaces || [];
      const sel = $("workspace");
      sel.innerHTML = workspaces.map((w) =>
        \`<option value="\${w.id}">\${w.slackTeamId} (\${w.plan})</option>\`
      ).join("");
      if (workspaces[0]) sel.value = workspaces[0].id;
    }

    async function loadWatchlist() {
      const wsId = $("workspace").value;
      if (!wsId) return;
      const data = await api("/watches?workspaceId=" + encodeURIComponent(wsId));
      watches = data.watches || [];
      $("watches").innerHTML = watches.map((w) => \`
        <tr>
          <td><strong>\${escapeHtml(w.competitor)}</strong></td>
          <td><span class="tag">\${escapeHtml(w.label)}</span></td>
          <td><a href="\${escapeAttr(w.url)}" target="_blank" rel="noreferrer">\${escapeHtml(w.url)}</a></td>
          <td class="muted">\${fmt(w.lastCrawlAt)}</td>
        </tr>\`).join("") || '<tr><td colspan="4" class="muted">No watches yet.</td></tr>';

      const ws = workspaces.find((w) => w.id === wsId);
      const competitors = new Set(watches.map((w) => w.competitor.toLowerCase())).size;
      $("caps").textContent = ws
        ? \`Plan: \${ws.plan} · \${competitors} competitors · \${watches.length} URLs\`
        : "";
    }

    async function loadChanges() {
      const wsId = $("workspace").value;
      if (!wsId) return;
      const data = await api("/workspaces/" + encodeURIComponent(wsId) + "/changes");
      const rows = data.changes || [];
      $("changes").innerHTML = rows.map((c) => \`
        <tr>
          <td class="muted">\${fmt(c.createdAt)}</td>
          <td><span class="tag \${c.materiality}">\${c.materiality}</span></td>
          <td><a href="#" data-change="\${escapeAttr(c.id)}">\${escapeHtml(c.summary)}</a></td>
          <td>\${c.snapshotUrl ? \`<a href="\${escapeAttr(c.snapshotUrl)}" target="_blank">view</a>\` : "—"}</td>
        </tr>\`).join("") || '<tr><td colspan="4" class="muted">No changes yet.</td></tr>';

      $("changes").onclick = async (ev) => {
        const a = ev.target.closest("[data-change]");
        if (!a) return;
        ev.preventDefault();
        const detail = await api("/changes/" + encodeURIComponent(a.dataset.change));
        const el = $("detail");
        el.classList.add("visible");
        el.innerHTML = \`
          <strong>\${escapeHtml(detail.change.summary)}</strong>
          <p class="muted">\${escapeHtml(detail.change.materiality)} · \${fmt(detail.change.createdAt)}</p>
          <p>\${(detail.change.citations || []).map((c) => \`<a href="\${escapeAttr(c)}">\${escapeHtml(c)}</a>\`).join("<br/>")}</p>
          <p>\${detail.snapshotUrl ? \`Snapshot: <a href="\${escapeAttr(detail.snapshotUrl)}">\${escapeHtml(detail.snapshotUrl)}</a>\` : "No snapshot link"}</p>
        \`;
      };
    }

    async function loadUsage() {
      const wsId = $("workspace").value;
      if (!wsId) return;
      const data = await api("/workspaces/" + encodeURIComponent(wsId) + "/usage");
      const dollars = ((data.totalCostCents || 0) / 100).toFixed(2);
      const parts = Object.entries(data.byMetric || {}).map(([k, v]) =>
        \`\${k}: \${v.quantity} ($\${(v.costCents / 100).toFixed(2)})\`
      );
      $("usage").textContent = \`Total $\${dollars}\` + (parts.length ? " · " + parts.join(" · ") : "");
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[c]);
    }
    function escapeAttr(s) { return escapeHtml(s); }

    async function refresh() {
      await loadWorkspaces();
      await Promise.all([loadWatchlist(), loadChanges(), loadUsage()]);
    }

    $("refresh").onclick = refresh;
    $("workspace").onchange = () => Promise.all([loadWatchlist(), loadChanges(), loadUsage()]);
    refresh().catch((err) => { $("usage").textContent = String(err); });
  </script>
</body>
</html>`;
}
