-- Phase 1 schema extensions: plans/caps, R2 keys, crawl runs, usage, quiet mode

ALTER TABLE workspaces ADD COLUMN plan TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE workspaces ADD COLUMN quiet_mode TEXT NOT NULL DEFAULT 'all_quiet';

ALTER TABLE watches ADD COLUMN last_crawl_at TEXT;
ALTER TABLE watches ADD COLUMN last_success_at TEXT;

ALTER TABLE snapshots ADD COLUMN crawl_run_id TEXT;
ALTER TABLE snapshots ADD COLUMN r2_key TEXT;
ALTER TABLE snapshots ADD COLUMN markdown TEXT;

ALTER TABLE change_events ADD COLUMN from_snapshot_id TEXT;
ALTER TABLE change_events ADD COLUMN to_snapshot_id TEXT;

ALTER TABLE battlecard_drafts ADD COLUMN published_at TEXT;

ALTER TABLE digest_deliveries ADD COLUMN blocks_json TEXT;

CREATE TABLE IF NOT EXISTS crawl_runs (
  id TEXT PRIMARY KEY,
  watch_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (watch_id) REFERENCES watches(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_workspace ON crawl_runs(workspace_id);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  quantity REAL NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  at TEXT NOT NULL,
  meta TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_workspace ON usage_ledger(workspace_id);
