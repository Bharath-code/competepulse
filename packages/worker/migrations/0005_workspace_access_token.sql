-- Per-workspace API tokens: only the SHA-256 hash is stored.

ALTER TABLE workspaces ADD COLUMN access_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_access_token_hash
  ON workspaces (access_token_hash) WHERE access_token_hash IS NOT NULL;
