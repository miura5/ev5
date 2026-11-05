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

-- Collections, memberships, pins, item properties, own sets and own attempts (PLAN section 5.10). Additive and idempotent; ev4 ignores them.
-- `views` is left out on purpose: saved views come after the cutover. Timestamps are ms; `v` is the docs protocol version.
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  parent_id TEXT,
  pos REAL NOT NULL DEFAULT 0,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS memberships (
  item_c TEXT NOT NULL,
  item_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (item_c, item_id)
);
CREATE INDEX IF NOT EXISTS memberships_collection ON memberships (collection_id);
CREATE TABLE IF NOT EXISTS pins (
  target_c TEXT NOT NULL,
  target_id TEXT NOT NULL,
  pos REAL NOT NULL DEFAULT 0,
  at INTEGER NOT NULL,
  PRIMARY KEY (target_c, target_id)
);
CREATE TABLE IF NOT EXISTS item_props (
  c TEXT NOT NULL,
  id TEXT NOT NULL,
  time TEXT,
  repeat TEXT,
  linked_c TEXT,
  linked_id TEXT,
  overrides TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (c, id)
);
CREATE TABLE IF NOT EXISTS own_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  source_c TEXT,
  source_id TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS own_attempts (
  set_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  key TEXT NOT NULL,
  at INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (set_id, item_id, key, at)
);

-- The usage key of each settled ceiling hold. Additive and idempotent. Migrations only add (no ALTER), so the
-- key lives in its own row beside the hold: one row per usage key, written in the same batch that closes the hold.
CREATE TABLE IF NOT EXISTS ceiling_usage (
  key TEXT PRIMARY KEY,
  hold_id TEXT NOT NULL
);
