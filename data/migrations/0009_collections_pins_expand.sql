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
