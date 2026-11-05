// node areas/notes/roundTrip.script.ts <scratch-export.json>: read-only, counts-only check that every note of a
// restricted scratch copy of a live-record export survives blocks -> editor document -> blocks. It prints how many notes
// came back identical, changed or failed, and never a note's text, title or id (§sec.live-data, §sec.staging-data).
// Refuses a file inside this repository or readable by group or others, so a copy can't land where it is committed.
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { isAbsolute, relative } from 'node:path';
import { parseNote } from '../../domain/index.ts';
import { blocksToDoc, docToBlocks } from './parts/editorDoc.ts';

export interface RoundTripReport {
  notes: number;
  stable: number;
  changed: number;
  /** The note did not parse or the conversion threw: counted by the error's class name only. */
  failed: Record<string, number>;
}

/** Why this file may not be read, or null. Fixed phrases only. */
export function pathProblem(file: string, repoRoot: string): string | null {
  let real: string;
  try {
    real = realpathSync(file);
  } catch {
    return 'the file cannot be opened';
  }
  const rel = relative(realpathSync(repoRoot), real);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return 'the file is inside this repository';
  const st = statSync(real);
  if (!st.isFile()) return 'the path is not a file';
  if (st.mode & 0o077) return 'the file is readable by others: chmod 600 it first';
  return null;
}

const kindOf = (e: unknown): string => {
  const name = e instanceof Error ? e.constructor.name : '';
  return /^[A-Za-z]{1,30}$/.test(name) ? name : 'other';
};

/** Round-trips each note document of an export's `notes` collection. Rows may hold the document as a JSON string. */
export function roundTripNotes(docs: unknown[]): RoundTripReport {
  const report: RoundTripReport = {
    notes: 0,
    stable: 0,
    changed: 0,
    failed: {},
  };
  const fail = (k: string) => (report.failed[k] = (report.failed[k] ?? 0) + 1);
  for (const d of docs) {
    const row = (typeof d === 'object' && d !== null ? d : {}) as {
      c?: unknown;
      data?: unknown;
    };
    if (row.c !== 'notes') continue;
    report.notes++;
    try {
      const note = parseNote(typeof row.data === 'string' ? JSON.parse(row.data) : row.data);
      const back = docToBlocks(blocksToDoc(note.blocks));
      if (isDeepStrictEqual(back, note.blocks)) report.stable++;
      else report.changed++;
    } catch (e) {
      fail(kindOf(e));
    }
  }
  return report;
}

export const failedTotal = (r: RoundTripReport): number => Object.values(r.failed).reduce((a, b) => a + b, 0);

export function render(r: RoundTripReport): string[] {
  const failed = Object.entries(r.failed)
    .sort()
    .map(([k, n]) => `${n} x ${k}`);
  return [
    `notes: ${r.notes}, stable: ${r.stable}, changed: ${r.changed}, failed: ${failedTotal(r)}${failed.length ? ` (${failed.join('; ')})` : ''}`,
  ];
}

/** Runs the check on a file; returns the lines to print and the exit code. */
export function run(file: string | undefined, repoRoot: string): { lines: string[]; code: number } {
  if (!file)
    return {
      lines: ['usage: node areas/notes/roundTrip.script.ts <scratch-export.json>'],
      code: 2,
    };
  const bad = pathProblem(file, repoRoot);
  if (bad) return { lines: [`refused: ${bad}`], code: 2 };
  let exp: { kind?: unknown; schema?: unknown; docs?: unknown };
  try {
    exp = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { lines: ['refused: the file is not JSON'], code: 2 };
  }
  if (exp?.kind !== 'ev-d1-export' || exp.schema !== 1 || !Array.isArray(exp.docs))
    return {
      lines: ['refused: the file is not an ev-d1-export, schema 1'],
      code: 2,
    };
  const report = roundTripNotes(exp.docs);
  return {
    lines: render(report),
    code: report.changed || failedTotal(report) ? 1 : 0,
  };
}

if (import.meta.main) {
  const { lines, code } = run(process.argv[2], new URL('../..', import.meta.url).pathname);
  for (const l of lines) console.log(l);
  process.exit(code);
}
