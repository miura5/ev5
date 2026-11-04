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
