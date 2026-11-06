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
