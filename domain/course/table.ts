import type { CourseRule, CourseTable } from './types.ts';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function patternProblem(n: string, what: string, p: unknown): string | null {
  if (p == null) return null;
  try {
    new RegExp(String(p), 'i');
    return null;
  } catch {
    return `${n}: ${what} is not a pattern`;
  }
}

function ruleProblems(n: string, c: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (!['active', 'done'].includes(c.status as string)) out.push(`${n}: status is not active or done`);
  if (!Number.isInteger(c.canvasId)) out.push(`${n}: canvasId is not a Canvas course id`);
  if (!strList(c.examKinds) || !c.examKinds.length) out.push(`${n}: examKinds is not a list of exam kinds`);
  for (const k of ['reviewKinds', 'examDayKinds', 'scoredKinds'])
    if (!strList(c[k]) || c[k].some((x) => !(c.examKinds as string[] | undefined)?.includes(x)))
      out.push(`${n}: ${k} is not a list of its examKinds`);
  if (!strList(c.calendarDayKinds)) out.push(`${n}: calendarDayKinds is not a list`);
  if (c.dayBudget !== 'shared') out.push(`${n}: dayBudget must be shared`);
  for (const r of ['aliases', 'guess']) {
    const p = patternProblem(n, r, c[r]);
    if (p) out.push(p);
  }
  const lib = c.library;
  if (!Array.isArray(lib) || lib.some((r) => !isObj(r) || !r.module || !r.kind))
    out.push(`${n}: library is not a list of module rules with module and kind`);
  else
    for (const r of lib as { module: string; only?: string }[]) {
      const what = `library rule ${r.module}`;
      const p = patternProblem(n, what, r.module) ?? patternProblem(n, what, r.only);
      if (p) out.push(p);
    }
  return out;
}

/** Reads a course table object (keys starting with "_" are notes) into a table; throws naming every problem. */
export function parseCourseTable(raw: unknown): CourseTable {
  if (!isObj(raw)) throw new Error('courses: missing');
  const names = Object.keys(raw).filter((k) => !k.startsWith('_'));
  const problems: string[] = names.length ? [] : ['courses: names no course'];
  for (const n of names) {
    const c = raw[n];
    if (isObj(c)) problems.push(...ruleProblems(n, c));
    else problems.push(`${n}: not an object`);
  }
  if (names.filter((n) => isObj(raw[n]) && raw[n].default).length !== 1)
    problems.push('courses: needs exactly one default course');
  if (problems.length) throw new Error(problems.join('; '));
  return names.map((name) => ({ name, ...(raw[name] as object) }) as CourseRule);
}
