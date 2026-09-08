import {
  planLimits,
  UPGRADE_MESSAGE,
  type ExtractSnapshot,
  type PlanId,
  type UsageMetric,
  type WatchLabel,
} from "@competepulse/core";
import type { SubscriptionStatus } from "./billing/dodo.js";
import {
  CapError,
  type BattlecardDraft,
  type CrawlRun,
  type DigestDelivery,
  type Snapshot,
  type Store,
  type StoredChange,
  type UsageEntry,
  type Watch,
  type Workspace,
  type WorkspacePatch,
} from "./store.js";
import { workspaceFromRow, buildWorkspaceUpdateSql, type WorkspaceRow } from "./workspace-store.js";

type WatchRow = {
  id: string;
  workspace_id: string;
  competitor: string;
  url: string;
  label: string;
  last_crawl_at: string | null;
  last_success_at: string | null;
  created_at: string;
};

type SnapshotRow = {
  id: string;
  watch_id: string;
  crawl_run_id: string | null;
  content_hash: string;
  r2_key: string | null;
  extracted_json: string;
  markdown: string | null;
  created_at: string;
};

type ChangeRow = {
  id: string;
  watch_id: string;
  materiality: string;
  summary: string;
  findings_json: string;
  citations_json: string;
  from_snapshot_id: string | null;
  to_snapshot_id: string | null;
  created_at: string;
};

type BattlecardRow = {
  id: string;
  workspace_id: string;
  change_event_id: string;
  body_md: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
};

type DigestRow = {
  id: string;
  workspace_id: string;
  delivery_date: string;
  body: string;
  blocks_json: string | null;
  created_at: string;
};

type CrawlRunRow = {
  id: string;
  watch_id: string;
  workspace_id: string;
  status: string;
  provider: string | null;
  attempt: number;
  error: string | null;
  cost_cents: number;
  started_at: string;
  finished_at: string | null;
};

type UsageRow = {
  id: string;
  workspace_id: string;
  metric: string;
  quantity: number;
  cost_cents: number;
  at: string;
  meta: string | null;
};

function watchFromRow(row: WatchRow): Watch {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    competitor: row.competitor,
    url: row.url,
    label: row.label as WatchLabel,
    lastCrawlAt: row.last_crawl_at,
    lastSuccessAt: row.last_success_at,
    createdAt: row.created_at,
  };
}

function snapshotFromRow(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    watchId: row.watch_id,
    crawlRunId: row.crawl_run_id,
    contentHash: row.content_hash,
    r2Key: row.r2_key ?? "",
    extracted: JSON.parse(row.extracted_json) as ExtractSnapshot,
    markdown: row.markdown ?? "",
    createdAt: row.created_at,
  };
}

function changeFromRow(row: ChangeRow): StoredChange {
  return {
    id: row.id,
    watchId: row.watch_id,
    materiality: row.materiality as StoredChange["materiality"],
    summary: row.summary,
    findings: JSON.parse(row.findings_json) as StoredChange["findings"],
    citations: JSON.parse(row.citations_json) as string[],
    fromSnapshotId: row.from_snapshot_id ?? undefined,
    toSnapshotId: row.to_snapshot_id ?? undefined,
    createdAt: row.created_at,
  };
}

function battlecardFromRow(row: BattlecardRow): BattlecardDraft {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    changeId: row.change_event_id,
    body: row.body_md,
    status: row.status as BattlecardDraft["status"],
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
  };
}

function digestFromRow(row: DigestRow): DigestDelivery {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    deliveryDate: row.delivery_date,
    body: row.body,
    blocksJson: row.blocks_json ?? undefined,
    createdAt: row.created_at,
  };
}

function crawlFromRow(row: CrawlRunRow): CrawlRun {
  return {
    id: row.id,
    watchId: row.watch_id,
    workspaceId: row.workspace_id,
    status: row.status as CrawlRun["status"],
    provider: row.provider as CrawlRun["provider"],
    attempt: row.attempt,
    error: row.error,
    costCents: row.cost_cents,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function usageFromRow(row: UsageRow): UsageEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    metric: row.metric as UsageMetric,
    quantity: row.quantity,
    costCents: row.cost_cents,
    at: row.at,
    meta: row.meta ?? undefined,
  };
}

/**
 * D1-backed product store (Path B1). Single SoR for workspaces, watches,
 * snapshots, changes, digests, battlecards, usage, and webhook idempotency.
 */
export class D1Store implements Store {
  constructor(private readonly db: D1Database) {}

  async ensureWorkspace(slackTeamId: string, plan: PlanId = "starter"): Promise<Workspace> {
    const existing = await this.db
      .prepare("SELECT * FROM workspaces WHERE slack_team_id = ?")
      .bind(slackTeamId)
      .first<WorkspaceRow>();
    if (existing) return workspaceFromRow(existing);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO workspaces (
          id, slack_team_id, plan, digest_cron, quiet_mode, subscription_status, created_at
        ) VALUES (?, ?, ?, '0 13 * * 1-5', 'all_quiet', 'none', ?)
        ON CONFLICT(slack_team_id) DO NOTHING`,
      )
      .bind(id, slackTeamId, plan, createdAt)
      .run();

    const row = await this.db
      .prepare("SELECT * FROM workspaces WHERE slack_team_id = ?")
      .bind(slackTeamId)
      .first<WorkspaceRow>();
    if (!row) throw new Error("failed to create workspace");
    return workspaceFromRow(row);
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM workspaces ORDER BY created_at ASC")
      .all<WorkspaceRow>();
    return results.map(workspaceFromRow);
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM workspaces WHERE id = ?")
      .bind(id)
      .first<WorkspaceRow>();
    return row ? workspaceFromRow(row) : undefined;
  }

  async updateWorkspace(id: string, patch: WorkspacePatch): Promise<Workspace | undefined> {
    const built = buildWorkspaceUpdateSql(patch);
    if (!built) return this.getWorkspace(id);
    await this.db
      .prepare(built.sql)
      .bind(...built.values, id)
      .run();
    return this.getWorkspace(id);
  }

  async getWorkspaceBySubscriptionId(subscriptionId: string): Promise<Workspace | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM workspaces WHERE dodo_subscription_id = ?")
      .bind(subscriptionId)
      .first<WorkspaceRow>();
    return row ? workspaceFromRow(row) : undefined;
  }

  async claimWebhook(webhookId: string): Promise<boolean> {
    const existing = await this.db
      .prepare("SELECT webhook_id FROM processed_webhooks WHERE webhook_id = ?")
      .bind(webhookId)
      .first();
    if (existing) return false;
    await this.db
      .prepare("INSERT INTO processed_webhooks (webhook_id, processed_at) VALUES (?, ?)")
      .bind(webhookId, new Date().toISOString())
      .run();
    return true;
  }

  async setDigestChannel(workspaceId: string, channelId: string): Promise<Workspace | undefined> {
    return this.updateWorkspace(workspaceId, { digestChannelId: channelId });
  }

  private async ensureWorkspaceRecord(workspaceId: string): Promise<void> {
    const existing = await this.getWorkspace(workspaceId);
    if (existing) return;
    const createdAt = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO workspaces (
          id, slack_team_id, plan, digest_cron, quiet_mode, subscription_status, created_at
        ) VALUES (?, ?, 'starter', '0 13 * * 1-5', 'all_quiet', 'none', ?)
        ON CONFLICT(id) DO NOTHING`,
      )
      .bind(workspaceId, workspaceId, createdAt)
      .run();
  }

  async addWatch(input: {
    competitor: string;
    url: string;
    label: WatchLabel;
    workspaceId?: string;
  }): Promise<Watch> {
    const workspaceId = input.workspaceId ?? (await this.ensureWorkspace("local")).id;
    await this.ensureWorkspaceRecord(workspaceId);
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) throw new Error("workspace not found");
    const limits = planLimits(workspace.plan);
    const existing = await this.listWatches(workspaceId);

    if (existing.length >= limits.urlLimit) {
      throw new CapError(
        `${UPGRADE_MESSAGE} (${limits.name} allows ${limits.urlLimit} URLs; this would be #${existing.length + 1}.)`,
        limits,
      );
    }

    const competitors = new Set(existing.map((w) => w.competitor.toLowerCase()));
    const isNewCompetitor = !competitors.has(input.competitor.toLowerCase());
    if (isNewCompetitor && competitors.size >= limits.competitorLimit) {
      throw new CapError(
        `${UPGRADE_MESSAGE} (${limits.name} allows ${limits.competitorLimit} competitors.)`,
        limits,
      );
    }

    const watch: Watch = {
      id: crypto.randomUUID(),
      workspaceId,
      competitor: input.competitor,
      url: input.url,
      label: input.label,
      lastCrawlAt: null,
      lastSuccessAt: null,
      createdAt: new Date().toISOString(),
    };
    await this.db
      .prepare(
        `INSERT INTO watches (id, workspace_id, competitor, url, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(watch.id, watch.workspaceId, watch.competitor, watch.url, watch.label, watch.createdAt)
      .run();
    return watch;
  }

  async listWatches(workspaceId?: string): Promise<Watch[]> {
    if (workspaceId) {
      const { results } = await this.db
        .prepare("SELECT * FROM watches WHERE workspace_id = ? ORDER BY created_at ASC")
        .bind(workspaceId)
        .all<WatchRow>();
      return results.map(watchFromRow);
    }
    const { results } = await this.db
      .prepare("SELECT * FROM watches ORDER BY created_at ASC")
      .all<WatchRow>();
    return results.map(watchFromRow);
  }

  async getWatch(id: string): Promise<Watch | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM watches WHERE id = ?")
      .bind(id)
      .first<WatchRow>();
    return row ? watchFromRow(row) : undefined;
  }

  async touchWatch(id: string, success: boolean): Promise<void> {
    const watch = await this.getWatch(id);
    if (!watch) return;
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE watches SET last_crawl_at = ?, last_success_at = ? WHERE id = ?`,
      )
      .bind(now, success ? now : watch.lastSuccessAt, id)
      .run();
  }

  async removeWatch(id: string, workspaceId?: string): Promise<boolean> {
    const watch = await this.getWatch(id);
    if (!watch) return false;
    if (workspaceId && watch.workspaceId !== workspaceId) return false;
    await this.db.prepare("DELETE FROM change_events WHERE watch_id = ?").bind(id).run();
    await this.db.prepare("DELETE FROM snapshots WHERE watch_id = ?").bind(id).run();
    await this.db.prepare("DELETE FROM crawl_runs WHERE watch_id = ?").bind(id).run();
    await this.db.prepare("DELETE FROM watches WHERE id = ?").bind(id).run();
    return true;
  }

  async latestSnapshot(watchId: string): Promise<Snapshot | undefined> {
    const row = await this.db
      .prepare(
        "SELECT * FROM snapshots WHERE watch_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .bind(watchId)
      .first<SnapshotRow>();
    return row ? snapshotFromRow(row) : undefined;
  }

  async listSnapshots(watchId: string): Promise<Snapshot[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM snapshots WHERE watch_id = ? ORDER BY created_at ASC")
      .bind(watchId)
      .all<SnapshotRow>();
    return results.map(snapshotFromRow);
  }

  async getSnapshot(id: string): Promise<Snapshot | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM snapshots WHERE id = ?")
      .bind(id)
      .first<SnapshotRow>();
    return row ? snapshotFromRow(row) : undefined;
  }

  async addSnapshot(snapshot: Snapshot): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO snapshots (
          id, watch_id, content_hash, extracted_json, created_at, crawl_run_id, r2_key, markdown
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        snapshot.id,
        snapshot.watchId,
        snapshot.contentHash,
        JSON.stringify(snapshot.extracted),
        snapshot.createdAt,
        snapshot.crawlRunId,
        snapshot.r2Key,
        snapshot.markdown,
      )
      .run();
  }

  async addChange(change: StoredChange): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO change_events (
          id, watch_id, materiality, summary, findings_json, citations_json,
          created_at, from_snapshot_id, to_snapshot_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        change.id,
        change.watchId,
        change.materiality,
        change.summary,
        JSON.stringify(change.findings),
        JSON.stringify(change.citations),
        change.createdAt,
        change.fromSnapshotId ?? null,
        change.toSnapshotId ?? null,
      )
      .run();
  }

  async listChanges(watchId: string): Promise<StoredChange[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM change_events WHERE watch_id = ? ORDER BY created_at ASC")
      .bind(watchId)
      .all<ChangeRow>();
    return results.map(changeFromRow);
  }

  async listWorkspaceChanges(workspaceId: string): Promise<StoredChange[]> {
    const watches = await this.listWatches(workspaceId);
    const out: StoredChange[] = [];
    for (const w of watches) {
      out.push(...(await this.listChanges(w.id)));
    }
    return out;
  }

  async getChange(id: string): Promise<StoredChange | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM change_events WHERE id = ?")
      .bind(id)
      .first<ChangeRow>();
    return row ? changeFromRow(row) : undefined;
  }

  async addBattlecard(draft: BattlecardDraft): Promise<BattlecardDraft> {
    await this.db
      .prepare(
        `INSERT INTO battlecard_drafts (
          id, workspace_id, change_event_id, body_md, status, approved_by, approved_at, published_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        draft.id,
        draft.workspaceId,
        draft.changeId,
        draft.body,
        draft.status,
        draft.approvedBy ?? null,
        draft.approvedAt ?? null,
        draft.publishedAt ?? null,
        draft.createdAt,
      )
      .run();
    return draft;
  }

  async getBattlecard(id: string): Promise<BattlecardDraft | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM battlecard_drafts WHERE id = ?")
      .bind(id)
      .first<BattlecardRow>();
    return row ? battlecardFromRow(row) : undefined;
  }

  async updateBattlecard(draft: BattlecardDraft): Promise<BattlecardDraft> {
    await this.db
      .prepare(
        `UPDATE battlecard_drafts SET
          body_md = ?, status = ?, approved_by = ?, approved_at = ?, published_at = ?
         WHERE id = ?`,
      )
      .bind(
        draft.body,
        draft.status,
        draft.approvedBy ?? null,
        draft.approvedAt ?? null,
        draft.publishedAt ?? null,
        draft.id,
      )
      .run();
    return draft;
  }

  async getDigestDelivery(
    workspaceId: string,
    deliveryDate: string,
  ): Promise<DigestDelivery | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM digest_deliveries WHERE workspace_id = ? AND delivery_date = ?",
      )
      .bind(workspaceId, deliveryDate)
      .first<DigestRow>();
    return row ? digestFromRow(row) : null;
  }

  async saveDigestDelivery(input: {
    workspaceId: string;
    deliveryDate: string;
    body: string;
    blocksJson?: string;
  }): Promise<DigestDelivery> {
    const existing = await this.getDigestDelivery(input.workspaceId, input.deliveryDate);
    if (existing) return existing;
    const delivery: DigestDelivery = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      deliveryDate: input.deliveryDate,
      body: input.body,
      blocksJson: input.blocksJson,
      createdAt: new Date().toISOString(),
    };
    await this.db
      .prepare(
        `INSERT INTO digest_deliveries (
          id, workspace_id, delivery_date, body, created_at, blocks_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        delivery.id,
        delivery.workspaceId,
        delivery.deliveryDate,
        delivery.body,
        delivery.createdAt,
        delivery.blocksJson ?? null,
      )
      .run();
    return delivery;
  }

  async addCrawlRun(run: CrawlRun): Promise<CrawlRun> {
    await this.db
      .prepare(
        `INSERT INTO crawl_runs (
          id, watch_id, workspace_id, status, provider, attempt, error, cost_cents, started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        run.id,
        run.watchId,
        run.workspaceId,
        run.status,
        run.provider,
        run.attempt,
        run.error,
        run.costCents,
        run.startedAt,
        run.finishedAt,
      )
      .run();
    return run;
  }

  async updateCrawlRun(run: CrawlRun): Promise<CrawlRun> {
    await this.db
      .prepare(
        `UPDATE crawl_runs SET
          status = ?, provider = ?, attempt = ?, error = ?, cost_cents = ?, finished_at = ?
         WHERE id = ?`,
      )
      .bind(run.status, run.provider, run.attempt, run.error, run.costCents, run.finishedAt, run.id)
      .run();
    return run;
  }

  async getCrawlRun(id: string): Promise<CrawlRun | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM crawl_runs WHERE id = ?")
      .bind(id)
      .first<CrawlRunRow>();
    return row ? crawlFromRow(row) : undefined;
  }

  async listCrawlRuns(workspaceId?: string): Promise<CrawlRun[]> {
    if (workspaceId) {
      const { results } = await this.db
        .prepare("SELECT * FROM crawl_runs WHERE workspace_id = ? ORDER BY started_at ASC")
        .bind(workspaceId)
        .all<CrawlRunRow>();
      return results.map(crawlFromRow);
    }
    const { results } = await this.db
      .prepare("SELECT * FROM crawl_runs ORDER BY started_at ASC")
      .all<CrawlRunRow>();
    return results.map(crawlFromRow);
  }

  async recordUsage(entry: Omit<UsageEntry, "id">): Promise<UsageEntry> {
    const full: UsageEntry = { ...entry, id: crypto.randomUUID() };
    await this.db
      .prepare(
        `INSERT INTO usage_ledger (id, workspace_id, metric, quantity, cost_cents, at, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        full.id,
        full.workspaceId,
        full.metric,
        full.quantity,
        full.costCents,
        full.at,
        full.meta ?? null,
      )
      .run();
    return full;
  }

  async listUsage(workspaceId: string): Promise<UsageEntry[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM usage_ledger WHERE workspace_id = ? ORDER BY at ASC")
      .bind(workspaceId)
      .all<UsageRow>();
    return results.map(usageFromRow);
  }

  async usageSummary(workspaceId: string) {
    const entries = await this.listUsage(workspaceId);
    const byMetric: Record<string, { quantity: number; costCents: number }> = {};
    let totalCostCents = 0;
    for (const e of entries) {
      totalCostCents += e.costCents;
      const bucket = byMetric[e.metric] ?? { quantity: 0, costCents: 0 };
      bucket.quantity += e.quantity;
      bucket.costCents += e.costCents;
      byMetric[e.metric] = bucket;
    }
    return { workspaceId, totalCostCents, byMetric, entries };
  }
}

// Re-export for callers that imported via d1-store historically.
export type { SubscriptionStatus };
