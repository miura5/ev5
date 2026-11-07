-- Baseline of the first tables. Every statement is IF NOT EXISTS, so it changes nothing where they already exist.
CREATE TABLE IF NOT EXISTS docs (
  c TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (c, id)
);
CREATE INDEX IF NOT EXISTS docs_at ON docs (at);
CREATE TABLE IF NOT EXISTS claude_usage (
  hour INTEGER PRIMARY KEY,
  day TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS claude_usage_day ON claude_usage (day);
CREATE TABLE IF NOT EXISTS claude_reads (
  note TEXT PRIMARY KEY,
  h TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS claude_settings (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS claude_plan_asks (
  job TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS system_docs (
  name TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  at INTEGER NOT NULL
);
