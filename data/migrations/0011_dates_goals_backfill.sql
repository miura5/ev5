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
