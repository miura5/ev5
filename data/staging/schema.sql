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

-- Indexes for every pointer column the row shapes name (§data.tables: a pointer is a typed column with an index, or a
-- (kind, id) pair indexed only where it can name several kinds). Additive and idempotent; ev4 ignores them.
CREATE INDEX IF NOT EXISTS collections_parent ON collections (parent_id);
CREATE INDEX IF NOT EXISTS own_sets_source ON own_sets (source_c, source_id);
CREATE INDEX IF NOT EXISTS item_props_linked ON item_props (linked_c, linked_id);
CREATE INDEX IF NOT EXISTS drafts_target ON drafts (target_c, target_id);
CREATE INDEX IF NOT EXISTS ceiling_usage_hold ON ceiling_usage (hold_id);

-- The per-kind tables (docs/proposals/table-design.md): one table per stored kind, each held to its domain row
-- shape by row-shapes.test.ts. Additive and idempotent. Ids carry the kind prefix as a CHECK (§data.tables); `at` and `v`
-- are on every table (§data.protocol); `deleted_at` only where the user can delete (§delete.soft); JSON columns are text.
-- plans, plan_items and repeats wait for their row shapes. The old docs-backed tables stay until the contract migration.
ALTER TABLE collections ADD COLUMN deleted_at INTEGER;

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'goal_'),
  collection_id TEXT,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  date TEXT,
  status TEXT NOT NULL,
  score REAL,
  created_by TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS goals_collection ON goals (collection_id);
CREATE INDEX IF NOT EXISTS goals_date ON goals (date);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'obj_'),
  collection_id TEXT NOT NULL,
  num INTEGER,
  text TEXT NOT NULL,
  chapters TEXT,
  source_ref TEXT,
  created_by TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS objectives_collection ON objectives (collection_id, num);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'link_'),
  from_kind TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_kind TEXT NOT NULL,
  to_id TEXT NOT NULL,
  "by" TEXT NOT NULL,
  note TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS links_pair ON links (from_kind, from_id, to_kind, to_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS links_to ON links (to_kind, to_id);
CREATE INDEX IF NOT EXISTS links_from ON links (from_kind, from_id);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'note_'),
  collection_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  text TEXT NOT NULL,
  earlier_of TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS notes_collection ON notes (collection_id);
CREATE INDEX IF NOT EXISTS notes_earlier ON notes (earlier_of);
CREATE INDEX IF NOT EXISTS notes_at ON notes (at);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'set_'),
  collection_id TEXT,
  kind TEXT NOT NULL,
  title TEXT,
  source_kind TEXT,
  source_id TEXT,
  created_by TEXT NOT NULL,
  job_id TEXT,
  focus TEXT,
  asked INTEGER,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS sets_collection ON sets (collection_id);
CREATE INDEX IF NOT EXISTS sets_source ON sets (source_kind, source_id);
CREATE INDEX IF NOT EXISTS sets_job ON sets (job_id);

CREATE TABLE IF NOT EXISTS set_items (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'item_'),
  set_id TEXT NOT NULL,
  pos REAL NOT NULL,
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  objective_id TEXT,
  weak_spot_id TEXT,
  source_ref TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS set_items_set ON set_items (set_id, pos);
CREATE INDEX IF NOT EXISTS set_items_objective ON set_items (objective_id);
CREATE INDEX IF NOT EXISTS set_items_weak_spot ON set_items (weak_spot_id);

-- Append-only: the body an edit replaced. The id is `<item_id>@<item_v>`.
CREATE TABLE IF NOT EXISTS set_item_versions (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'item_'),
  item_id TEXT NOT NULL,
  item_v INTEGER NOT NULL,
  body TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS set_item_versions_item ON set_item_versions (item_id, item_v);

CREATE TABLE IF NOT EXISTS weak_spots (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 3) = 'ws_'),
  collection_id TEXT,
  objective_id TEXT,
  topic TEXT NOT NULL,
  kind TEXT NOT NULL,
  words TEXT,
  source_line TEXT NOT NULL,
  duplicate_of TEXT,
  proposed INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  pre_read INTEGER NOT NULL,
  reading_due TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS weak_spots_objective ON weak_spots (objective_id);
CREATE INDEX IF NOT EXISTS weak_spots_collection ON weak_spots (collection_id);
CREATE INDEX IF NOT EXISTS weak_spots_duplicate ON weak_spots (duplicate_of);

CREATE TABLE IF NOT EXISTS weak_spot_events (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'wse_'),
  weak_spot_id TEXT NOT NULL,
  type TEXT NOT NULL,
  "by" TEXT NOT NULL,
  note TEXT,
  objective_id TEXT,
  "until" TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS weak_spot_events_spot ON weak_spot_events (weak_spot_id, at);
CREATE INDEX IF NOT EXISTS weak_spot_events_objective ON weak_spot_events (objective_id);

-- Append-only: one row per answer, for every kind of practice. No deleted_at, no update.
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'att_'),
  item_id TEXT NOT NULL,
  item_v INTEGER NOT NULL,
  set_id TEXT NOT NULL,
  session_id TEXT,
  source TEXT NOT NULL,
  how TEXT NOT NULL,
  answer TEXT,
  score REAL,
  answered_at INTEGER NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS attempts_item ON attempts (item_id, at);
CREATE INDEX IF NOT EXISTS attempts_set ON attempts (set_id, at);
CREATE INDEX IF NOT EXISTS attempts_session ON attempts (session_id);
CREATE INDEX IF NOT EXISTS attempts_at ON attempts (at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'ses_'),
  kind TEXT NOT NULL,
  note_id TEXT,
  set_id TEXT,
  collection_id TEXT,
  day TEXT NOT NULL,
  status TEXT NOT NULL,
  planned_min INTEGER,
  started_at INTEGER,
  ended_at INTEGER,
  topic TEXT,
  clock TEXT,
  minutes INTEGER,
  driver TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS sessions_note ON sessions (note_id);
CREATE INDEX IF NOT EXISTS sessions_set ON sessions (set_id);
CREATE INDEX IF NOT EXISTS sessions_collection ON sessions (collection_id);
CREATE INDEX IF NOT EXISTS sessions_day ON sessions (day);
CREATE INDEX IF NOT EXISTS sessions_status ON sessions (status);

CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'sese_'),
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  body TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS session_events_session ON session_events (session_id, at);

-- Append-only: one row per line said in an Ask E.V. chat or a session check-in.
CREATE TABLE IF NOT EXISTS talk (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'talk_'),
  chat_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  session_id TEXT,
  context_kind TEXT,
  context_id TEXT,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  cites TEXT,
  job_id TEXT,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS talk_chat ON talk (chat_id, at);
CREATE INDEX IF NOT EXISTS talk_session ON talk (session_id);
