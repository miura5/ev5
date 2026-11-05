-- Indexes for every pointer column the row shapes name (§data.tables: a pointer is a typed column with an index, or a
-- (kind, id) pair indexed only where it can name several kinds). Additive and idempotent; ev4 ignores them.
CREATE INDEX IF NOT EXISTS collections_parent ON collections (parent_id);
CREATE INDEX IF NOT EXISTS own_sets_source ON own_sets (source_c, source_id);
CREATE INDEX IF NOT EXISTS item_props_linked ON item_props (linked_c, linked_id);
CREATE INDEX IF NOT EXISTS drafts_target ON drafts (target_c, target_id);
CREATE INDEX IF NOT EXISTS ceiling_usage_hold ON ceiling_usage (hold_id);
