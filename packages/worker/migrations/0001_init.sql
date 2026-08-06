-- CompetePulse D1 schema (PRD §13) — E1-3 watchlist + E1-4 digests + E1-5 HITL

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  slack_team_id TEXT NOT NULL UNIQUE,
  digest_channel_id TEXT,
  digest_cron TEXT NOT NULL DEFAULT '0 13 * * 1-5',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  competitor TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS idx_watches_workspace ON watches(workspace_id);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  watch_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  extracted_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (watch_id) REFERENCES watches(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_watch ON snapshots(watch_id);

CREATE TABLE IF NOT EXISTS change_events (
  id TEXT PRIMARY KEY,
  watch_id TEXT NOT NULL,
  materiality TEXT NOT NULL,
  summary TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  citations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (watch_id) REFERENCES watches(id)
);

CREATE INDEX IF NOT EXISTS idx_changes_watch ON change_events(watch_id);

CREATE TABLE IF NOT EXISTS battlecard_drafts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  change_event_id TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS idx_battlecards_workspace ON battlecard_drafts(workspace_id);

-- Idempotency key for weekday digests: one row per workspace/day
CREATE TABLE IF NOT EXISTS digest_deliveries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, delivery_date),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
