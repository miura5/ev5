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

/** Reads a spec.courses object (keys starting with "_" are notes) into a table; throws naming every problem. */
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

/** The course a document without one belongs to: the default, else the first; null for an empty table. */
export function defaultCourse(table: CourseTable): string | null {
  return (table.find((c) => c.default) ?? table[0])?.name ?? null;
}

/** Courses still being studied; a done course leaves search and the morning's passages unless he names it. */
export function activeCourses(table: CourseTable): string[] {
  return table.filter((c) => c.status !== 'done').map((c) => c.name);
}

/** A course name as the record writes it, to its table name (by its aliases); anything else as it came. */
export function normCourse(table: CourseTable, c: string | null | undefined): string | null {
  const t = String(c ?? '').trim();
  const hit = table.find((r) => r.name === t || (r.aliases && new RegExp(r.aliases, 'i').test(t)));
  return hit ? hit.name : c || null;
}

/** A document's course, normalised, else the default course. */
export function courseOf(table: CourseTable, x: { course?: string | null } | null | undefined): string | null {
  return normCourse(table, x?.course) ?? defaultCourse(table);
}

/** The course whose guess words the text holds, or null when none does. */
export function nameCourse(table: CourseTable, s: string): string | null {
  return table.find((r) => r.guess && new RegExp(r.guess, 'i').test(String(s ?? '')))?.name ?? null;
}

/** The course an attached file belongs to: the first whose guess words it holds, else the default course. */
export function guessCourse(table: CourseTable, s: string): string | null {
  return nameCourse(table, s) ?? defaultCourse(table);
}

type KindList = 'reviewKinds' | 'examDayKinds' | 'scoredKinds';
/** Whether an exam's kind is one of its course's <which> kinds. */
export function examIs(table: CourseTable, e: { course?: string | null; kind?: string }, which: KindList): boolean {
  const rule = table.find((c) => c.name === courseOf(table, e));
  return !!e.kind && !!rule?.[which].includes(e.kind);
}
