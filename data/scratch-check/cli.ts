// node data/scratch-check/cli.ts <scratch-export.json>: read-only, counts-only parse of a restricted scratch copy of
// a live-record export (run only with Matt's OK). Prints counts and error kinds, never content.
// Refuses a file inside this repository or readable by group or others, so a copy can't land where it is committed.
import { readFileSync, statSync, realpathSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';
import { parseExam, parseNote, parseObjective, parseSession, parseSet, parseWeakSpot } from '../../domain/index.ts';
import type { ParserRegistry } from '../docs/registry.ts';
import { checkExport, errorTotal, exportProblem, render } from './check.ts';

// ev4 collection -> v5 domain parser. The new v5 tables have no live data to parse.
export const PARSERS: ParserRegistry = {
  exams: parseExam,
  objectives: parseObjective,
  weakspots: parseWeakSpot,
  sets: parseSet,
  sessions: parseSession,
  notes: parseNote,
};

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

/** Runs the check on a file; returns the lines to print and the exit code. */
export function run(file: string | undefined, repoRoot: string): { lines: string[]; code: number } {
  if (!file) return { lines: ['usage: node data/scratch-check/cli.ts <scratch-export.json>'], code: 2 };
  const bad = pathProblem(file, repoRoot);
  if (bad) return { lines: [`refused: ${bad}`], code: 2 };
  let exp: unknown;
  try {
    exp = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { lines: ['refused: the file is not JSON'], code: 2 };
  }
  const problem = exportProblem(exp);
  if (problem) return { lines: [`refused: ${problem}`], code: 2 };
  const report = checkExport(exp as { docs: unknown[] }, PARSERS);
  return { lines: render(report), code: errorTotal(report) ? 1 : 0 };
}

if (import.meta.main) {
  const { lines, code } = run(process.argv[2], new URL('../..', import.meta.url).pathname);
  for (const l of lines) console.log(l);
  process.exit(code);
}
