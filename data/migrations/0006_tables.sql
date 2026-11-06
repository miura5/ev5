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
