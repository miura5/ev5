import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const dir = new URL('.', import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, dir), 'utf8');
const all = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const RENAME = '0016_prep_plan_names_backfill.sql';

test('migration 0016 renames stored prep plan names and runs once', () => {
  const db = new DatabaseSync(':memory:');
  for (const m of all.filter((f) => f < RENAME)) db.exec(read(m));
  const job = (id: string, kind: string, title: string) =>
    db.prepare('INSERT INTO job_records (id, data, at, v) VALUES (?, ?, 1, 1)').run(id, JSON.stringify({ id, kind, title, v: 1 }));
  job('j1', 'study_plan', 'Study plan');
  job('j2', 'practice_set', 'Practice set');
  const plan = (id: string, kind: string, body: unknown) =>
    db.prepare('INSERT INTO job_plans (job_id, kind, body, at) VALUES (?, ?, ?, 1)').run(id, kind, JSON.stringify(body));
  plan('j1', 'context', { exam: { id: 'e1', title: 'Unit 3', kind: 'exam', date: '2026-11-08', course: 'Biology' }, today: '2026-11-03', days: ['2026-11-03'] });
  plan('j1', 'draft', { summary: 's', tasks: [] });
  plan('j3', 'context', { goal: { id: 'g1', title: 'Run', kind: 'exam', date: '2026-12-01' } });

  const sql = read(RENAME);
  db.exec(sql);
  const once = JSON.stringify([
    db.prepare('SELECT * FROM job_records ORDER BY id').all(),
    db.prepare('SELECT * FROM job_plans ORDER BY job_id, kind').all(),
  ]);
  db.exec(sql);
  assert.equal(
    JSON.stringify([
      db.prepare('SELECT * FROM job_records ORDER BY id').all(),
      db.prepare('SELECT * FROM job_plans ORDER BY job_id, kind').all(),
    ]),
    once,
  );

  const data = (id: string) => JSON.parse(String(db.prepare('SELECT data FROM job_records WHERE id = ?').get(id)?.data));
  assert.deepEqual(data('j1'), { id: 'j1', kind: 'prep_plan', title: 'Prep plan', v: 1 });
  assert.deepEqual(data('j2'), { id: 'j2', kind: 'practice_set', title: 'Practice set', v: 1 });
  const body = (id: string, kind: string) =>
    JSON.parse(String(db.prepare('SELECT body FROM job_plans WHERE job_id = ? AND kind = ?').get(id, kind)?.body));
  assert.deepEqual(body('j1', 'context'), {
    goal: { id: 'e1', title: 'Unit 3', kind: 'exam', date: '2026-11-08' },
    today: '2026-11-03',
    days: ['2026-11-03'],
  });
  assert.deepEqual(body('j1', 'draft'), { summary: 's', tasks: [] });
  assert.deepEqual(body('j3', 'context'), { goal: { id: 'g1', title: 'Run', kind: 'exam', date: '2026-12-01' } });
});
