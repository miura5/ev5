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
