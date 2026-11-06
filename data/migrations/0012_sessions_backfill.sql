-- One-way copy of the older `sessions` documents into the `sessions` and `session_events` tables (§data.tables,
-- §data.append-only, §data.additive). A document id `ss-x` becomes the row `ses_ss-x`; each entry of its events map becomes one
-- row `sese_ss-x:<key>`, with its own `at` (else the time in its key). Only note sessions are copied, and an event whose type
-- or time cannot be read is left out. INSERT OR IGNORE, so a second run adds nothing. A deleted document stays deleted
-- (deleted_at from `deletions`). The `sessions` documents stay in `docs` until the contract migration.
INSERT OR IGNORE INTO sessions (id, kind, note_id, set_id, collection_id, day, status, planned_min, started_at, ended_at, topic, clock, minutes, driver, at, v, deleted_at)
SELECT 'ses_' || d.id, 'note',
  CASE WHEN json_type(d.data, '$.noteId') = 'text' THEN NULLIF(json_extract(d.data, '$.noteId'), '') END,
  NULL, NULL,
  json_extract(d.data, '$.date'),
  CASE WHEN json_extract(d.data, '$.status') IN ('active', 'ending', 'ended', 'discarded') THEN json_extract(d.data, '$.status')
       WHEN json_type(d.data, '$.endedAt') = 'text' THEN 'ended' ELSE 'active' END,
  CASE WHEN json_type(d.data, '$.planned') = 'integer' AND json_extract(d.data, '$.planned') >= 0 THEN json_extract(d.data, '$.planned') END,
  CAST(ROUND((julianday(json_extract(d.data, '$.startedAt')) - 2440587.5) * 86400000) AS INTEGER),
  CAST(ROUND((julianday(json_extract(d.data, '$.endedAt')) - 2440587.5) * 86400000) AS INTEGER),
  CASE WHEN json_type(d.data, '$.topic') = 'text' THEN json_extract(d.data, '$.topic') END,
  CASE WHEN json_extract(d.data, '$.clock') = 'writing' THEN 'writing' END,
  CASE WHEN json_type(d.data, '$.minutes') IN ('integer', 'real') THEN MAX(0, CAST(ROUND(json_extract(d.data, '$.minutes')) AS INTEGER)) END,
  CASE WHEN json_type(d.data, '$.driver.view') = 'text'
        AND julianday(json_extract(d.data, '$.driver.at')) IS NOT NULL
       THEN json_object('view', json_extract(d.data, '$.driver.view'),
         'at', CAST(ROUND((julianday(json_extract(d.data, '$.driver.at')) - 2440587.5) * 86400000) AS INTEGER)) END,
  d.at, d.v,
  (SELECT x.at FROM deletions x WHERE x.c = 'sessions' AND x.id = d.id)
FROM docs d
WHERE d.c = 'sessions' AND json_valid(d.data) AND d.id NOT GLOB '*[^A-Za-z0-9-]*'
  AND COALESCE(json_extract(d.data, '$.kind'), 'note') = 'note'
  AND json_extract(d.data, '$.date') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]';

INSERT OR IGNORE INTO session_events (id, session_id, type, body, at, v)
SELECT 'sese_' || y.sid || ':' || y.key, 'ses_' || y.sid, json_extract(y.ev, '$.type'),
  NULLIF(json_remove(y.ev, '$.type', '$.at'), '{}'), y.ms, 1
FROM (
  SELECT x.sid, x.key, x.ev,
    COALESCE(
      CAST(ROUND((julianday(json_extract(x.ev, '$.at')) - 2440587.5) * 86400000) AS INTEGER),
      CASE WHEN x.pos IS NOT NULL THEN CAST(ROUND((julianday(
        substr(x.key, x.pos, 4) || '-' || substr(x.key, x.pos + 4, 2) || '-' || substr(x.key, x.pos + 6, 2) || 'T' ||
        substr(x.key, x.pos + 9, 2) || ':' || substr(x.key, x.pos + 11, 2) || ':' || substr(x.key, x.pos + 13, 2) || 'Z') - 2440587.5) * 86400000) AS INTEGER) END
    ) AS ms
  FROM (
    SELECT d.id AS sid, e.key AS key, e.value AS ev,
      (SELECT min(j.value) FROM json_each('[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40]') j
        WHERE substr(e.key, j.value - 1, 1) = '-'
          AND substr(e.key, j.value, 15) GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]') AS pos
    FROM docs d, json_each(d.data, '$.events') e
    WHERE d.c = 'sessions' AND json_valid(d.data) AND json_type(e.value) = 'object'
      AND e.key NOT GLOB '*[^A-Za-z0-9-]*'
  ) x
) y
WHERE y.ms IS NOT NULL AND y.ms >= 0
  AND json_extract(y.ev, '$.type') IN ('start', 'check', 'idle', 'skip', 'break', 'resume', 'extend', 'answer', 'end', 'step', 'reopen', 'pause', 'write')
  AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = 'ses_' || y.sid);
