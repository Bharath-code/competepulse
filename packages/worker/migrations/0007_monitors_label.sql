-- Monitors are unique per (url, label): the label picks the extraction schema and goal.
-- 0006 shipped moments before any monitor existed, so the table is empty and is
-- rebuilt rather than migrated. Reversible: recreate monitors with UNIQUE(url) (drop label).

DROP TABLE IF EXISTS monitors;

CREATE TABLE monitors (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  provider_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE (url, label)
);
