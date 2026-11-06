-- Plans, plan items and repeats (docs/proposals/table-design.md 2.9), and drafts.target_kind. Additive and idempotent.
-- Ids carry the kind prefix as a CHECK (§data.tables); `at` and `v` on every table; `deleted_at` where the user can delete.
-- drafts keeps target_c until the contract migration: writers fill both columns meanwhile. No backfill here (a migration
-- never updates rows); a draft is short-lived and the gate writes target_kind from now on.
ALTER TABLE drafts ADD COLUMN target_kind TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'plan_'),
  goal_id TEXT NOT NULL,
  job_id TEXT,
  state TEXT NOT NULL,
  title TEXT,
  from_day TEXT NOT NULL,
  to_day TEXT NOT NULL,
  summary TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS plans_goal ON plans (goal_id);
CREATE INDEX IF NOT EXISTS plans_job ON plans (job_id);
-- At most one plan in force per goal (a plan put in the bin no longer counts, as checkOneInForce).
CREATE UNIQUE INDEX IF NOT EXISTS plans_one_in_force ON plans (goal_id) WHERE state = 'in_force' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS repeats (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'rep_'),
  title TEXT NOT NULL,
  minutes INTEGER,
  time TEXT,
  rule TEXT NOT NULL,
  from_day TEXT NOT NULL,
  to_day TEXT,
  linked_kind TEXT,
  linked_id TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS repeats_linked ON repeats (linked_kind, linked_id);

CREATE TABLE IF NOT EXISTS plan_items (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'pli_'),
  plan_id TEXT,
  day TEXT NOT NULL,
  pos REAL NOT NULL,
  title TEXT NOT NULL,
  minutes INTEGER,
  time TEXT,
  origin TEXT NOT NULL,
  linked_kind TEXT,
  linked_id TEXT,
  repeat_id TEXT,
  done_at INTEGER,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS plan_items_day ON plan_items (day, pos);
CREATE INDEX IF NOT EXISTS plan_items_plan ON plan_items (plan_id);
CREATE INDEX IF NOT EXISTS plan_items_linked ON plan_items (linked_kind, linked_id);
-- A repeat puts one row on a day, even after the user removed it (§data.repeat).
CREATE UNIQUE INDEX IF NOT EXISTS plan_items_repeat_day ON plan_items (repeat_id, day) WHERE repeat_id IS NOT NULL;
