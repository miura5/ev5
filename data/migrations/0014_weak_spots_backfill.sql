-- One-way copy of the older `weakspots` documents into the `weak_spots` and `weak_spot_events` tables (§data.tables,
-- §data.append-only, §data.additive). A document id `w1` becomes the row `ws_w1` (an id already starting `ws_` is kept); each
-- entry of its events map becomes one row `wse_<spot>:<key>`, with its own `at` (else the time in its key). The starting
-- counts (`initial`) and the links array are dropped (D-498). The course (an id or a title) becomes `collection_id` when it
-- names a collection. An event whose type or time cannot be read, or a snooze without `until`, is left out. INSERT OR IGNORE,
-- so a second run adds nothing. A deleted document stays deleted (deleted_at from `deletions`). The documents stay in `docs`
-- until the contract migration.
INSERT OR IGNORE INTO weak_spots (id, collection_id, objective_id, topic, kind, words, source_line, duplicate_of, proposed, created_by, pre_read, reading_due, at, v, deleted_at)
SELECT CASE WHEN substr(d.id, 1, 3) = 'ws_' THEN d.id ELSE 'ws_' || d.id END,
  (SELECT c.id FROM collections c WHERE lower(c.id) = lower(json_extract(d.data, '$.course')) OR lower(c.title) = lower(json_extract(d.data, '$.course')) LIMIT 1),
  NULLIF(json_extract(d.data, '$.objective'), ''),
  json_extract(d.data, '$.topic'),
  json_extract(d.data, '$.kind'),
  CASE WHEN json_type(d.data, '$.words') = 'text' THEN json_extract(d.data, '$.words') END,
  json_extract(d.data, '$.source'),
  NULL,
  CASE WHEN json_extract(d.data, '$.proposed') IN (1, 'true') THEN 1 ELSE 0 END,
  CASE WHEN json_extract(d.data, '$.writer') = 'page' THEN 'user' ELSE 'ev' END,
  CASE WHEN json_extract(d.data, '$.preRead') IN (1, 'true') THEN 1 ELSE 0 END,
  CASE WHEN json_extract(d.data, '$.readingDue') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' THEN json_extract(d.data, '$.readingDue') END,
  d.at, d.v,
  (SELECT x.at FROM deletions x WHERE x.c = 'weakspots' AND x.id = d.id)
FROM docs d
WHERE d.c = 'weakspots' AND json_valid(d.data) AND d.id NOT GLOB '*[^A-Za-z0-9_-]*'
  AND json_type(d.data, '$.topic') = 'text' AND json_extract(d.data, '$.topic') <> ''
  AND json_type(d.data, '$.source') = 'text' AND json_extract(d.data, '$.source') <> ''
  AND json_extract(d.data, '$.kind') IN ('concept', 'note', 'connection', 'format', 'skill');

INSERT OR IGNORE INTO weak_spot_events (id, weak_spot_id, type, "by", note, objective_id, "until", at, v)
SELECT 'wse_' || y.sid || ':' || y.key, y.spot, json_extract(y.ev, '$.type'),
  CASE WHEN json_extract(y.ev, '$.by') IN ('owner', 'page', 'user') THEN 'user' ELSE 'ev' END,
  CASE WHEN json_type(y.ev, '$.note') = 'text' THEN json_extract(y.ev, '$.note') END,
  NULLIF(CASE WHEN json_type(y.ev, '$.objective') = 'text' THEN json_extract(y.ev, '$.objective') END, ''),
  CASE WHEN json_extract(y.ev, '$.until') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' THEN json_extract(y.ev, '$.until') END,
  y.ms, 1
FROM (
  SELECT x.sid, x.spot, x.key, x.ev,
    COALESCE(
      CAST(ROUND((julianday(json_extract(x.ev, '$.at')) - 2440587.5) * 86400000) AS INTEGER),
      CASE WHEN x.pos IS NOT NULL THEN CAST(ROUND((julianday(
        substr(x.key, x.pos, 4) || '-' || substr(x.key, x.pos + 4, 2) || '-' || substr(x.key, x.pos + 6, 2) || 'T' ||
        substr(x.key, x.pos + 9, 2) || ':' || substr(x.key, x.pos + 11, 2) || ':' || substr(x.key, x.pos + 13, 2) || 'Z') - 2440587.5) * 86400000) AS INTEGER) END
    ) AS ms
  FROM (
    SELECT d.id AS sid, CASE WHEN substr(d.id, 1, 3) = 'ws_' THEN d.id ELSE 'ws_' || d.id END AS spot, e.key AS key, e.value AS ev,
      (SELECT min(j.value) FROM json_each('[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40]') j
        WHERE substr(e.key, j.value - 1, 1) = '-'
          AND substr(e.key, j.value, 15) GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]') AS pos
    FROM docs d, json_each(d.data, '$.events') e
    WHERE d.c = 'weakspots' AND json_valid(d.data) AND json_type(e.value) = 'object'
      AND d.id NOT GLOB '*[^A-Za-z0-9_-]*' AND e.key NOT GLOB '*[^A-Za-z0-9-]*'
  ) x
) y
WHERE y.ms IS NOT NULL AND y.ms >= 0
  AND json_extract(y.ev, '$.type') IN ('park', 'activate', 'solid', 'done', 'move', 'seen', 'reopen', 'accept', 'snooze', 'decline')
  AND (json_extract(y.ev, '$.type') <> 'snooze' OR json_extract(y.ev, '$.until') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
  AND EXISTS (SELECT 1 FROM weak_spots s WHERE s.id = y.spot);
