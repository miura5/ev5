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

-- One-way copy of Matt's own sets into the shared set tables (§data.tables, §data.additive). Ids made before the
-- tables carry no kind prefix and gain `set_` and `item_`; a prefixed id is kept. Only INSERT ... SELECT, and OR IGNORE so a
-- second run adds nothing. The own_* tables stay as they were until the contract migration.
INSERT OR IGNORE INTO sets (id, collection_id, kind, title, source_kind, source_id, created_by, at, v)
SELECT CASE WHEN substr(s.id, 1, 4) = 'set_' THEN s.id ELSE 'set_' || s.id END,
  (SELECT m.collection_id FROM memberships m WHERE m.item_c = 'own_sets' AND m.item_id = s.id),
  'adhoc', s.title,
  CASE WHEN s.source_c IS NOT NULL AND s.source_id IS NOT NULL THEN s.source_c END,
  CASE WHEN s.source_c IS NOT NULL AND s.source_id IS NOT NULL THEN s.source_id END,
  'user', s.at, s.v
FROM own_sets s;

INSERT OR IGNORE INTO set_items (id, set_id, pos, type, body, at, v, deleted_at)
SELECT CASE WHEN substr(i.item_id, 1, 5) = 'item_' THEN i.item_id ELSE 'item_' || i.item_id END,
  CASE WHEN substr(i.set_id, 1, 4) = 'set_' THEN i.set_id ELSE 'set_' || i.set_id END,
  i.pos, COALESCE(json_extract(i.body, '$.type'), 'single'), json_remove(i.body, '$.id'), i.at, i.v,
  (SELECT d.at FROM deletions d WHERE d.c = 'own_set_items' AND d.id = i.set_id || '/' || i.item_id)
FROM own_set_items i;

-- A deletion is listed by the new `<set>/<item>` key, and each earlier attempt is read under the new ids.
INSERT OR IGNORE INTO deletions (c, id, at)
SELECT 'own_set_items',
  CASE WHEN substr(i.set_id, 1, 4) = 'set_' THEN i.set_id ELSE 'set_' || i.set_id END || '/' ||
  CASE WHEN substr(i.item_id, 1, 5) = 'item_' THEN i.item_id ELSE 'item_' || i.item_id END, d.at
FROM own_set_items i JOIN deletions d ON d.c = 'own_set_items' AND d.id = i.set_id || '/' || i.item_id;

INSERT OR IGNORE INTO own_attempts (set_id, item_id, key, at, body)
SELECT CASE WHEN substr(a.set_id, 1, 4) = 'set_' THEN a.set_id ELSE 'set_' || a.set_id END,
  CASE WHEN substr(a.item_id, 1, 5) = 'item_' THEN a.item_id ELSE 'item_' || a.item_id END, a.key, a.at, a.body
FROM own_attempts a;

INSERT OR IGNORE INTO memberships (item_c, item_id, collection_id, at, v)
SELECT 'sets', CASE WHEN substr(m.item_id, 1, 4) = 'set_' THEN m.item_id ELSE 'set_' || m.item_id END, m.collection_id, m.at, m.v
FROM memberships m WHERE m.item_c = 'own_sets';

-- Expand step for collections and pins (docs/proposals/table-design.md 2.1, 2.14; §data.additive). `collections` already has its
-- columns (0006 added deleted_at). `pins` gains the id, version, soft delete and target_kind its row shape wants, beside the
-- old target_c, which the contract migration drops; writers fill both until then. The defaults are placeholders that
-- 0010 backfills; a new row gets its real id from the gate. Ids are unique once set.
ALTER TABLE pins ADD COLUMN id TEXT NOT NULL DEFAULT '';
ALTER TABLE pins ADD COLUMN target_kind TEXT NOT NULL DEFAULT '';
ALTER TABLE pins ADD COLUMN v INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pins ADD COLUMN deleted_at INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS pins_id ON pins (id) WHERE id <> '';
CREATE INDEX IF NOT EXISTS pins_target ON pins (target_kind, target_id);

-- Migrate step for collections and pins (§data.additive): collection ids gain the `col_` prefix (§data.tables) and every
-- reference follows; pins get an id and target_kind. The only migration that rewrites rows, so the ban on UPDATE lets
-- `*_backfill` files through. Idempotent: each statement matches only rows not yet changed. A deleted collection's
-- `deletions` row is copied under the new id (the old one stays), and its deleted_at is read from it. `course:` ids are virtual
-- and never stored as a collection id; they are left as they are.
INSERT OR IGNORE INTO deletions (c, id, at)
SELECT 'collections', 'col_' || id, at FROM deletions WHERE c = 'collections' AND substr(id, 1, 4) <> 'col_';

UPDATE collections SET parent_id = 'col_' || parent_id WHERE parent_id IS NOT NULL AND substr(parent_id, 1, 4) <> 'col_';
UPDATE collections SET id = 'col_' || id WHERE substr(id, 1, 4) <> 'col_';
UPDATE collections SET deleted_at = (SELECT d.at FROM deletions d WHERE d.c = 'collections' AND d.id = collections.id)
WHERE deleted_at IS NULL AND EXISTS (SELECT 1 FROM deletions d WHERE d.c = 'collections' AND d.id = collections.id);

UPDATE memberships SET collection_id = 'col_' || collection_id WHERE substr(collection_id, 1, 4) <> 'col_' AND substr(collection_id, 1, 7) <> 'course:';
UPDATE goals SET collection_id = 'col_' || collection_id WHERE collection_id IS NOT NULL AND substr(collection_id, 1, 4) <> 'col_' AND substr(collection_id, 1, 7) <> 'course:';
UPDATE objectives SET collection_id = 'col_' || collection_id WHERE substr(collection_id, 1, 4) <> 'col_' AND substr(collection_id, 1, 7) <> 'course:';
UPDATE notes SET collection_id = 'col_' || collection_id WHERE collection_id IS NOT NULL AND substr(collection_id, 1, 4) <> 'col_' AND substr(collection_id, 1, 7) <> 'course:';
UPDATE sets SET collection_id = 'col_' || collection_id WHERE collection_id IS NOT NULL AND substr(collection_id, 1, 4) <> 'col_' AND substr(collection_id, 1, 7) <> 'course:';
UPDATE weak_spots SET collection_id = 'col_' || collection_id WHERE collection_id IS NOT NULL AND substr(collection_id, 1, 4) <> 'col_' AND substr(collection_id, 1, 7) <> 'course:';
UPDATE sessions SET collection_id = 'col_' || collection_id WHERE collection_id IS NOT NULL AND substr(collection_id, 1, 4) <> 'col_' AND substr(collection_id, 1, 7) <> 'course:';

UPDATE pins SET target_id = 'col_' || target_id WHERE target_c = 'collections' AND substr(target_id, 1, 4) <> 'col_';
UPDATE pins SET target_kind = target_c WHERE target_kind = '';
UPDATE pins SET id = 'pin_' || printf('%011x', at) || lower(hex(randomblob(4))) WHERE id = '';

-- One-way copy of the older `dates` documents into the `goals` table, with their objective links (§data.tables,
-- §data.links, §data.additive). A date's goal id is `goal_` and its document id, so a second run adds nothing (OR IGNORE).
-- A change kept in `dateedits.overrides` (date, title) is folded in. A deleted date stays deleted (deleted_at from
-- `deletions`). The `dates`, `dateedits` and `exams` documents are left as they are until the contract migration.
INSERT OR IGNORE INTO goals (id, collection_id, title, kind, date, status, score, created_by, at, v, deleted_at)
SELECT 'goal_' || d.id,
  (SELECT c.id FROM collections c WHERE c.id = json_extract(d.data, '$.course')),
  COALESCE(NULLIF(json_extract(e.data, '$.overrides.title'), ''), NULLIF(json_extract(d.data, '$.title'), ''), 'Untitled'),
  COALESCE(NULLIF(json_extract(d.data, '$.kind'), ''), 'other'),
  CASE WHEN COALESCE(json_extract(e.data, '$.overrides.date'), json_extract(d.data, '$.date'))
         GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
       THEN COALESCE(json_extract(e.data, '$.overrides.date'), json_extract(d.data, '$.date')) END,
  CASE WHEN json_extract(d.data, '$.status') = 'done' THEN 'done' ELSE 'open' END,
  NULL,
  CASE WHEN json_extract(d.data, '$.writer') = 'page' THEN 'user' ELSE 'ev' END,
  d.at, 1,
  (SELECT x.at FROM deletions x WHERE x.c = 'dates' AND x.id = d.id)
FROM docs d LEFT JOIN docs e ON e.c = 'dateedits' AND e.id = d.id
WHERE d.c = 'dates' AND json_valid(d.data) AND d.id NOT GLOB '*[^A-Za-z0-9]*';

-- An objective listed on the date becomes an objective -> goal link, when that objective exists.
INSERT OR IGNORE INTO links (id, from_kind, from_id, to_kind, to_id, "by", note, at, v)
SELECT 'link_' || d.id || o.value, 'objective', o.value, 'goal', 'goal_' || d.id, 'user', NULL, d.at, 1
FROM docs d, json_each(d.data, '$.objectives') o
WHERE d.c = 'dates' AND json_valid(d.data) AND d.id NOT GLOB '*[^A-Za-z0-9]*'
  AND o.type = 'text'
  AND EXISTS (SELECT 1 FROM goals g WHERE g.id = 'goal_' || d.id AND g.deleted_at IS NULL)
  AND EXISTS (SELECT 1 FROM objectives b WHERE b.id = o.value AND b.deleted_at IS NULL);

-- One-way copy of the older `sessions` documents into the `sessions` and `session_events` tables (§data.tables,
-- §data.append-only, §data.additive). A document id `ss-x` becomes the row `ses_ss-x`; each entry of its events map becomes one
-- row `sese_ss-x:<key>`, with its own `at` (else the time in its key). Only note sessions are copied, and an event whose type
-- or time cannot be read is left out. INSERT OR IGNORE, so a second run adds nothing. A deleted document stays deleted
-- (deleted_at from `deletions`). The `sessions` documents stay in `docs` until the contract migration.
INSERT OR IGNORE INTO sessions (id, kind, note_id, set_id, collection_id, day, status, planned_min, started_at, ended_at, topic, clock, minutes, driver, at, v, deleted_at)
SELECT 'ses_' || d.id, 'note',
  CASE WHEN json_type(d.data, '$.noteId') = 'text' THEN NULLIF(json_extract(d.data, '$.noteId'), '') END,
  NULL, NULL,
  json_extract(d.data, '$.date'),
  CASE WHEN json_extract(d.data, '$.status') IN ('active', 'ending', 'ended', 'discarded') THEN json_extract(d.data, '$.status')
       WHEN json_type(d.data, '$.endedAt') = 'text' THEN 'ended' ELSE 'active' END,
  CASE WHEN json_type(d.data, '$.planned') = 'integer' AND json_extract(d.data, '$.planned') >= 0 THEN json_extract(d.data, '$.planned') END,
  CAST(ROUND((julianday(json_extract(d.data, '$.startedAt')) - 2440587.5) * 86400000) AS INTEGER),
  CAST(ROUND((julianday(json_extract(d.data, '$.endedAt')) - 2440587.5) * 86400000) AS INTEGER),
  CASE WHEN json_type(d.data, '$.topic') = 'text' THEN json_extract(d.data, '$.topic') END,
  CASE WHEN json_extract(d.data, '$.clock') = 'writing' THEN 'writing' END,
  CASE WHEN json_type(d.data, '$.minutes') IN ('integer', 'real') THEN MAX(0, CAST(ROUND(json_extract(d.data, '$.minutes')) AS INTEGER)) END,
  CASE WHEN json_type(d.data, '$.driver.view') = 'text'
        AND julianday(json_extract(d.data, '$.driver.at')) IS NOT NULL
       THEN json_object('view', json_extract(d.data, '$.driver.view'),
         'at', CAST(ROUND((julianday(json_extract(d.data, '$.driver.at')) - 2440587.5) * 86400000) AS INTEGER)) END,
  d.at, d.v,
  (SELECT x.at FROM deletions x WHERE x.c = 'sessions' AND x.id = d.id)
FROM docs d
WHERE d.c = 'sessions' AND json_valid(d.data) AND d.id NOT GLOB '*[^A-Za-z0-9-]*'
  AND COALESCE(json_extract(d.data, '$.kind'), 'note') = 'note'
  AND json_extract(d.data, '$.date') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]';

INSERT OR IGNORE INTO session_events (id, session_id, type, body, at, v)
SELECT 'sese_' || y.sid || ':' || y.key, 'ses_' || y.sid, json_extract(y.ev, '$.type'),
  NULLIF(json_remove(y.ev, '$.type', '$.at'), '{}'), y.ms, 1
FROM (
  SELECT x.sid, x.key, x.ev,
    COALESCE(
      CAST(ROUND((julianday(json_extract(x.ev, '$.at')) - 2440587.5) * 86400000) AS INTEGER),
      CASE WHEN x.pos IS NOT NULL THEN CAST(ROUND((julianday(
        substr(x.key, x.pos, 4) || '-' || substr(x.key, x.pos + 4, 2) || '-' || substr(x.key, x.pos + 6, 2) || 'T' ||
        substr(x.key, x.pos + 9, 2) || ':' || substr(x.key, x.pos + 11, 2) || ':' || substr(x.key, x.pos + 13, 2) || 'Z') - 2440587.5) * 86400000) AS INTEGER) END
    ) AS ms
  FROM (
    SELECT d.id AS sid, e.key AS key, e.value AS ev,
      (SELECT min(j.value) FROM json_each('[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40]') j
        WHERE substr(e.key, j.value - 1, 1) = '-'
          AND substr(e.key, j.value, 15) GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]') AS pos
    FROM docs d, json_each(d.data, '$.events') e
    WHERE d.c = 'sessions' AND json_valid(d.data) AND json_type(e.value) = 'object'
      AND e.key NOT GLOB '*[^A-Za-z0-9-]*'
  ) x
) y
WHERE y.ms IS NOT NULL AND y.ms >= 0
  AND json_extract(y.ev, '$.type') IN ('start', 'check', 'idle', 'skip', 'break', 'resume', 'extend', 'answer', 'end', 'step', 'reopen', 'pause', 'write')
  AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = 'ses_' || y.sid);

-- One-way copy of the older `notes` documents into the `notes` table (§data.tables, §data.notes, §data.search,
-- §data.additive). A document id `n-x` becomes the row `note_n-x`. The title and the earlier link are columns; the rest of the
-- document (blocks, course, label, source, createdAt, editedAt, archivedAt, discardedAt) stays in `body`, so no note content
-- is dropped. `text` is the words of the blocks, one line per block, the only column search reads. The collection is the
-- note's `memberships` row. INSERT OR IGNORE, so a second run adds nothing. A deleted document stays deleted (deleted_at from
-- `deletions`). The `notes` documents stay in `docs` until the contract migration.
INSERT OR IGNORE INTO notes (id, collection_id, title, body, text, earlier_of, at, v, deleted_at)
SELECT 'note_' || d.id,
  (SELECT m.collection_id FROM memberships m WHERE m.item_c = 'notes' AND m.item_id = d.id),
  json_extract(d.data, '$.title'),
  json_remove(d.data, '$.title', '$.earlierOf', '$.at', '$.schema', '$.writer'),
  COALESCE((
    SELECT group_concat(line.t, char(10)) FROM (
      SELECT COALESCE((SELECT group_concat(COALESCE(json_extract(r.value, '$.text'), ''), '')
                       FROM json_each(b.value, '$.runs') r), '') AS t
      FROM json_each(d.data, '$.blocks') b ORDER BY b.key
    ) line
  ), ''),
  CASE WHEN json_type(d.data, '$.earlierOf') = 'text' AND json_extract(d.data, '$.earlierOf') <> d.id
       THEN 'note_' || json_extract(d.data, '$.earlierOf') END,
  d.at, d.v,
  (SELECT x.at FROM deletions x WHERE x.c = 'notes' AND x.id = d.id)
FROM docs d
WHERE d.c = 'notes' AND json_valid(d.data) AND d.id NOT GLOB '*[^A-Za-z0-9-]*'
  AND json_type(d.data, '$.title') = 'text'
  AND json_type(d.data, '$.blocks') = 'array';
