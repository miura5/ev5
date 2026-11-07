-- A delete writes a row here and removes nothing. Additive and idempotent.
CREATE TABLE IF NOT EXISTS deletions (
  c TEXT NOT NULL,
  id TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (c, id)
);
