import { stemGivesAway } from './key.ts';
import { openItemErrors, openAnswer, type OpenAnswer } from './open.ts';
import { ITEM_CONFIG, norm, type Item, type ItemConfig, type ItemType } from './types.ts';

const SELECT_N = /\bselect\s+(?:two|three|four|five|\d+)\b|\bchoose\s+(?:two|three|\d+)\b/i;
const TYPES: string[] = ['single', 'sata', 'matrix', 'numeric', 'open'];

/** The kind of question an item is: a type, else select-all when more than one answer is keyed. */
export function itemType(q: Item | null | undefined): ItemType {
  if (!q) return 'single';
  if (q.type === 'matrix' || q.type === 'numeric' || q.type === 'open') return q.type;
  return q.type === 'sata' || (Array.isArray(q.correct) && q.correct.length > 1) ? 'sata' : 'single';
}

/** A unit as the config names it (mL, mg, gtt/min, ...), matched without case or spaces; null if not one. */
export function unitOf(u: unknown, cfg: ItemConfig = ITEM_CONFIG): string | null {
  const k = String(u ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!k) return null;
  return cfg.units.find((x) => x.toLowerCase().replace(/\s+/g, '') === k) || null;
}

export type Validation = { ok: boolean; errors: string[]; warnings: string[] };

/** Checks one question. Errors make the item unusable; `strict` turns the missing-rationale and step warnings into errors. */
export function validateItem(raw: unknown, opts: { strict?: boolean; cfg?: ItemConfig } = {}): Validation {
  const cfg = opts.cfg ?? ITEM_CONFIG;
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
    errors.push(...openItemErrors(q, cfg.open));
  } else if (t === 'numeric') {
    if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) errors.push('numeric needs a number answer');
    if (!unitOf(q.unit, cfg)) errors.push('numeric needs a unit from the configured units, not ' + JSON.stringify(q.unit));
    if (q.tolerance != null && !(typeof q.tolerance === 'number' && q.tolerance >= 0))
      errors.push('tolerance must be a number of 0 or more');
    if (!Array.isArray(q.steps) || !q.steps.length || q.steps.some((x) => typeof x !== 'string' || !x.trim()))
      errors.push('numeric needs its worked steps');
    if (q.options || q.correct || q.matrix) errors.push('a numeric item has no options');
  } else if (t === 'matrix') {
    const m = q.matrix;
    if (!m || !Array.isArray(m.columns) || m.columns.length < 2 || m.columns.length > 4)
      errors.push('matrix needs 2-4 columns');
    else if (!Array.isArray(m.rows) || m.rows.length < 3 || m.rows.length > 6) errors.push('matrix needs 3-6 rows');
    else
      m.rows.forEach((r, i) => {
        if (!r || !r.text) errors.push(`matrix row ${i} has no text`);
        if (!Number.isInteger(r.correct) || r.correct < 0 || r.correct >= m.columns.length)
          errors.push(`matrix row ${i} has a bad answer`);
        if (!r.rationale) warnings.push(`matrix row ${i} has no rationale`);
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
        if (t === 'sata' && c.length < 2) errors.push('select-all needs two or more correct');
        if (t === 'sata' && c.length === o.length) warnings.push('every option is correct');
      }
      if (!Array.isArray(q.rationales) || q.rationales.length !== o.length)
        (opts.strict ? errors : warnings).push('needs one rationale per option');
    }
  }
  if (!q.objective) warnings.push('no objective');
  if (q.cjStep && !cfg.cjSteps.includes(q.cjStep)) errors.push('unknown clinical-judgment step ' + q.cjStep);
  if (!q.cjStep) (opts.strict ? errors : warnings).push('no clinical-judgment step');
  return { ok: errors.length === 0, errors, warnings };
}

/** A set's questions as every runner reads them: the usable ones whose stem does not give the answer away. */
export function validItems(items: unknown, opts: { strict?: boolean; cfg?: ItemConfig } = {}): Item[] {
  const list: unknown[] = Array.isArray(items) ? items : [];
  return list.filter((q) => validateItem(q, opts).ok && !stemGivesAway(q as Item)) as Item[];
}

/** A numeric answer as given: a number, a string ("2.5" or "2.5 mL") or {value, unit}; {value, unit} or null. */
function numericGiven(chosen: unknown): { value: number; unit: string | null } | null {
  if (chosen && typeof chosen === 'object' && !Array.isArray(chosen)) {
    const c = chosen as { value?: unknown; unit?: unknown };
    return typeof c.value === 'number' && Number.isFinite(c.value)
      ? { value: c.value, unit: c.unit ? String(c.unit) : null }
      : null;
  }
  if (typeof chosen === 'number') return Number.isFinite(chosen) ? { value: chosen, unit: null } : null;
  const m = String(chosen ?? '')
    .trim()
    .match(/^(-?\d+(?:\.\d+)?|-?\.\d+)\s*(.*)$/);
  return m ? { value: Number(m[1]), unit: m[2] || null } : null;
}

export type Scored = { correct: boolean; score: number };

/**
 * Scores an answer. chosen: option indexes (single/sata), one column index per row (matrix), the number given for a
 * numeric item (right within its tolerance and with its unit if one is given), or an open answer.
 */
export function scoreAnswer(q: Item, chosen: unknown, cfg: ItemConfig = ITEM_CONFIG): Scored | OpenAnswer {
  const t = itemType(q);
  if (t === 'open') return openAnswer(q, chosen, cfg.open);
  if (t === 'numeric') {
    const g = numericGiven(chosen);
    const tol = typeof q.tolerance === 'number' && q.tolerance > 0 ? q.tolerance : 0;
    const unitOk = !g || !g.unit || unitOf(g.unit, cfg) === unitOf(q.unit, cfg);
    const correct = !!g && unitOk && Math.abs(g.value - (q.answer ?? NaN)) <= tol + 1e-9;
    return { correct, score: correct ? 1 : 0 };
  }
  if (t === 'matrix') {
    const rows = q.matrix?.rows || [];
    const right = rows.filter((r, i) => Array.isArray(chosen) && chosen[i] === r.correct).length;
    return { correct: rows.length > 0 && right === rows.length, score: rows.length ? right / rows.length : 0 };
  }
  const c = [...(q.correct || [])].sort((a, b) => a - b);
  const ch = [...new Set(Array.isArray(chosen) ? (chosen as number[]) : [])].sort((a, b) => a - b);
  const correct = c.length === ch.length && c.every((v, i) => v === ch[i]);
  if (t === 'single') return { correct, score: correct ? 1 : 0 };
  const hits = ch.filter((i) => c.includes(i)).length;
  const falsePos = ch.length - hits; // NGN +/- scoring, floored at 0
  return { correct, score: c.length ? Math.max(0, hits - falsePos) / c.length : 0 };
}
