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
