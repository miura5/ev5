// Freeze guard (§data.migrations): the squashed baseline is never edited again. A change to the schema goes in a
// new numbered file that only adds (§data.additive). The pin below is the SHA-256 of data/migrations/0000_baseline.sql
// with line endings normalised to LF. Changing the baseline means changing the pin in the same commit and writing why
// in PIN_REASON, so the edit is deliberate and reviewed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from './lib.ts';

export const BASELINE = 'data/migrations/0000_baseline.sql';
export const PIN = 'fc783761866eb82585ab54ad763e052e173f360536b1be8443e83844b4d687c9';
const PIN_REASON = 'The squash (#877) plus the follow-ups #880 (attempts.was_due) and a later one (objectives.collection_id nullable, so an objective can hang off a goal by link only); nothing live applied any of them.';

export const hashBaseline = (text: string): string => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

export function checkMigrationFreeze(root: string, files: string[], pin = PIN): Finding[] {
  if (!files.some(f => f.startsWith('data/migrations/'))) return [];
  if (!files.includes(BASELINE)) return [{ check: 'migration-freeze', file: BASELINE, detail: 'the baseline is missing; it is frozen and is never deleted or renamed' }];
  const got = hashBaseline(fs.readFileSync(path.join(root, BASELINE), 'utf8'));
  return got === pin
    ? []
    : [{ check: 'migration-freeze', file: BASELINE, detail: `the baseline changed (sha256 ${got}; pinned for: ${PIN_REASON}). It is frozen: put the change in a new numbered migration. If this edit is deliberate, update PIN and PIN_REASON in ops/checks/migrationfreeze.ts in the same change` }];
}
