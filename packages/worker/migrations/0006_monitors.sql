-- E1: one Firecrawl monitor per URL, shared across tenants.
-- Reversible: DROP TABLE monitor_events; DROP TABLE monitors;

CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- id = dedupe key (checkId:scrapeId); the INSERT is the idempotency claim.
CREATE TABLE IF NOT EXISTS monitor_events (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL,
  payload_r2_key TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_watches_url ON watches (url);
