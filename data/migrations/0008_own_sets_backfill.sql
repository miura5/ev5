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
