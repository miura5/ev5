-- The files table (docs/proposals/table-design.md 2.12): one row per stored note picture, the bytes live in R2 under
-- `r2_key`. Expand only (§data.additive): a new table, nothing read or dropped. Soft-deletable (§delete.soft).
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'file_'),
  kind TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  v INTEGER NOT NULL DEFAULT 1,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS files_r2_key ON files (r2_key);
CREATE INDEX IF NOT EXISTS files_owner ON files (owner_kind, owner_id);
