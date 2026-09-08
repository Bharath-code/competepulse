-- Durable webhook idempotency + Slack install tokens (Path B1/B3)

CREATE TABLE IF NOT EXISTS processed_webhooks (
  webhook_id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL
);

ALTER TABLE workspaces ADD COLUMN slack_bot_token TEXT;
