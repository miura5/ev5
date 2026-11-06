-- The full practice run's stored name (§data.migrations): a practice set's saved scope (`job_plans` kind `scope`) that
-- names the variant "mock_exam" now names "full_run", the name the practice set job reads. Plain equality only, so a
-- second run changes nothing.
UPDATE job_plans SET body = json_set(body, '$.variant', 'full_run')
WHERE kind = 'scope' AND json_valid(body) AND json_extract(body, '$.variant') = 'mock_exam';
