-- E4-1: Dodo Payments subscription fields on workspaces

ALTER TABLE workspaces ADD COLUMN dodo_customer_id TEXT;
ALTER TABLE workspaces ADD COLUMN dodo_subscription_id TEXT;
ALTER TABLE workspaces ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE workspaces ADD COLUMN billing_email TEXT;

CREATE INDEX IF NOT EXISTS idx_workspaces_dodo_sub ON workspaces(dodo_subscription_id);
