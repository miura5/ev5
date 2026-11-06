-- Renames the prep plan's stored names (§data.additive): a job record of kind 'study_plan' becomes 'prep_plan' (its
-- title 'Study plan' becomes 'Prep plan'), and a saved plan context in job_plans keeps its date under `goal` instead of
-- `exam`, without the old `course` field. Plain equality only, so a second run changes nothing. The job's input and the
-- commands are not stored in D1; the plans, planedits and exams documents keep their own fields.
UPDATE job_records SET data = json_set(data, '$.kind', 'prep_plan')
WHERE json_valid(data) AND json_extract(data, '$.kind') = 'study_plan';

UPDATE job_records SET data = json_set(data, '$.title', 'Prep plan')
WHERE json_valid(data) AND json_extract(data, '$.kind') = 'prep_plan' AND json_extract(data, '$.title') = 'Study plan';

UPDATE job_plans SET body = json_remove(json_set(body, '$.goal', json(json_remove(json_extract(body, '$.exam'), '$.course'))), '$.exam')
WHERE kind = 'context' AND json_valid(body) AND json_type(body, '$.exam') = 'object' AND json_type(body, '$.goal') IS NULL;
