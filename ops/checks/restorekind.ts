// A restore takes v5's own export kind and nothing else (§data.own-db, §drift.checks). In the export, restore and
// server code, an export `kind` is never compared with or set to a string written out; it comes from EXPORT_KIND, so
// no code path can accept or build another app's backup file. restore.ts must refuse on EXPORT_KIND itself.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const SCOPE = /^(?:data\/export\/(?:export|restore|index)\.ts|ops\/restore-drill\/)/;
const SKIPPED = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.testkit\.ts$/;
const LITERAL_KIND = /\bkind\s*(?:[!=]==?|:)\s*["'`]|["'`]\s*[!=]==?\s*\w+\.kind\b/;
const SCANNED = /\.[cm]?[jt]sx?$/;

export function checkRestoreKind(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!SCOPE.test(f) || !SCANNED.test(f) || SKIPPED.test(f)) continue;
    const i = read(root, f).split('\n').findIndex(l => LITERAL_KIND.test(l) && !/EXPORT_KIND/.test(l));
    if (i >= 0) out.push({ check: 'restore-kind', file: f, detail: `line ${i + 1} writes an export kind as a string; use EXPORT_KIND, so only v5's own export is read or written (§data.own-db)` });
  }
  if (files.includes('data/export/restore.ts') && !/\.kind\s*!==\s*EXPORT_KIND/.test(read(root, 'data/export/restore.ts'))) {
    out.push({ check: 'restore-kind', file: 'data/export/restore.ts', detail: 'a restore must refuse any file whose kind is not EXPORT_KIND (§data.own-db)' });
  }
  return out;
}
