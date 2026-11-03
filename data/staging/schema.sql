-- Baseline: restates ev4's pwa/schema.sql. Every statement is IF NOT EXISTS, so it changes nothing where ev4's schema exists.
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

-- A delete writes a row here and removes nothing; ev4 ignores this table. Additive and idempotent.
CREATE TABLE IF NOT EXISTS deletions (
  c TEXT NOT NULL,
  id TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (c, id)
);

-- Job records, cost ceilings, job plan content, drafts and set items for v5 jobs. Additive and idempotent; ev4 ignores them.
CREATE TABLE IF NOT EXISTS job_records (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ceiling_use (
  w TEXT NOT NULL,
  k TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (w, k)
);
CREATE TABLE IF NOT EXISTS ceiling_holds (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  limits TEXT NOT NULL,
  open INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS job_plans (
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (job_id, kind)
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  target_c TEXT NOT NULL,
  target_id TEXT NOT NULL,
  body TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS drafts_job ON drafts (job_id);
CREATE TABLE IF NOT EXISTS own_set_items (
  set_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  pos INTEGER NOT NULL,
  body TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (set_id, item_id)
);
