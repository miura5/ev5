import { openItemErrors } from './open.ts';
import { ITEM_TYPES, norm, type Item } from './types.ts';

const SELECT_N = /\bselect\s+(?:two|three|four|five|\d+)\b|\bchoose\s+(?:two|three|\d+)\b/i;
const TYPES: readonly string[] = ITEM_TYPES;

export type Validation = { ok: boolean; errors: string[]; warnings: string[] };

/** Checks one question. Errors make the item unusable; `strict` turns the missing-rationale warning into an error. */
export function validateItem(raw: unknown, opts: { strict?: boolean } = {}): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['not an object'], warnings };
  const q = raw as Item;
  if (!q.id || typeof q.id !== 'string') errors.push('missing id');
  if (!q.stem || typeof q.stem !== 'string' || q.stem.trim().length < 10) errors.push('missing or too-short stem');
  const t: string = q.type || 'single';
  if (!TYPES.includes(t)) errors.push('unknown type ' + t);
  if (SELECT_N.test(q.stem || '')) errors.push('uses "select N" wording');
  if (t === 'open') {
    errors.push(...openItemErrors(q));
  } else if (t === 'numeric') {
    if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) errors.push('a number answer needs its value');
    if (q.unit != null && (typeof q.unit !== 'string' || !q.unit.trim())) errors.push('a unit must be some text');
    if (q.tolerance != null && !(typeof q.tolerance === 'number' && q.tolerance >= 0))
      errors.push('tolerance must be a number of 0 or more');
    if (!Array.isArray(q.steps) || !q.steps.length || q.steps.some((x) => typeof x !== 'string' || !x.trim()))
      errors.push('a number answer needs its worked steps');
    if (q.options || q.correct || q.grid) errors.push('a number answer has no options');
  } else if (t === 'grid') {
    const m = q.grid;
    if (!m || !Array.isArray(m.columns) || m.columns.length < 2 || m.columns.length > 4)
      errors.push('grid needs 2-4 columns');
    else if (!Array.isArray(m.rows) || m.rows.length < 3 || m.rows.length > 6) errors.push('grid needs 3-6 rows');
    else
      m.rows.forEach((r, i) => {
        if (!r || !r.text) errors.push(`grid row ${i} has no text`);
        if (!Number.isInteger(r.correct) || r.correct < 0 || r.correct >= m.columns.length)
          errors.push(`grid row ${i} has a bad answer`);
        if (!r.rationale) warnings.push(`grid row ${i} has no rationale`);
      });
  } else {
    const o = q.options;
    const c = q.correct;
    if (!Array.isArray(o) || o.length < 2) errors.push('needs at least 2 options');
    else {
      if (o.length > 6) errors.push('more than 6 options');
      if (o.some((x) => typeof x !== 'string' || !x.trim())) errors.push('empty option');
      if (new Set(o.map(norm)).size !== o.length) errors.push('duplicate options');
      if (!Array.isArray(c) || !c.length) errors.push('no correct answer');
      else {
        if (c.some((i) => !Number.isInteger(i) || i < 0 || i >= o.length)) errors.push('correct index out of range');
        if (new Set(c).size !== c.length) errors.push('duplicate correct index');
        if (t === 'single' && c.length !== 1) errors.push('single needs exactly one correct');
        if (t === 'multi_select' && c.length < 2) errors.push('select-all needs two or more correct');
        if (t === 'multi_select' && c.length === o.length) warnings.push('every option is correct');
      }
      if (!Array.isArray(q.rationales) || q.rationales.length !== o.length)
        (opts.strict ? errors : warnings).push('needs one rationale per option');
    }
  }
  if (!q.objective) warnings.push('no objective');
  return { ok: errors.length === 0, errors, warnings };
}
