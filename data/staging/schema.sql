-- Baseline: restates ev4's `docs` table (pwa/schema.sql); IF NOT EXISTS makes it a no-op where it exists.
-- Only `docs` is restated here; ev4's five small tables join when their columns are copied from ev4's schema.sql.
CREATE TABLE IF NOT EXISTS docs (
  c TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (c, id)
);
CREATE INDEX IF NOT EXISTS docs_at ON docs (at);
