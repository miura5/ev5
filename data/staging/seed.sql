-- Synthetic seed for ev5-staging only (PLAN C15): invented rows, no real record. Safe to re-run.
INSERT OR IGNORE INTO docs (c, id, data, at, v) VALUES
  ('notes', 'synthetic-1', '{"title":"Synthetic note one","tags":["BIO 201"]}', 1767225600000, 1),
  ('notes', 'synthetic-2', '{"title":"Synthetic note two","tags":["exam 2"]}', 1767225660000, 1),
  ('exams', 'synthetic-exam', '{"schema":2,"writer":"worker","at":"2026-11-01T00:00:00.000Z","source":"synthetic","title":"Synthetic unit exam","kind":"unit","course":"BIO 201","date":"2027-12-01","status":"upcoming"}', 1767225650000, 1),
  ('ideas', 'synthetic-1', '{"text":"A synthetic idea"}', 1767225720000, 1);
