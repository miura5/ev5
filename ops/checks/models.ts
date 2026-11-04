// §model.registry: a warning (never a failure) when jobs/runtime/models.ts was last checked too long ago.
// Reads the file's text, so the check stays a pure function over a root; the age limit is the file's own MAX_AGE_DAYS.
import fs from 'node:fs';
import path from 'node:path';

const FILE = 'jobs/runtime/models.ts';

export function checkModelsAge(root: string, now: Date = new Date()): string[] {
  const p = path.join(root, FILE);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  const on = /MODELS_CHECKED_ON\s*=\s*'(\d{4}-\d{2}-\d{2})'/.exec(text)?.[1];
  const max = Number(/MAX_AGE_DAYS\s*=\s*(\d+)/.exec(text)?.[1]);
  if (!on || !Number.isFinite(max)) return [`models: ${FILE}: no "checked on" date or age limit found`];
  const days = Math.floor((now.getTime() - Date.parse(on)) / 86_400_000);
  return days > max
    ? [`models: ${FILE}: model ids and prices were last checked on ${on}, ${days} days ago (limit ${max}). Check them against the Anthropic docs.`]
    : [];
}
