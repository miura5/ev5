import { ITEM_TYPES, SET_KINDS, SET_WRITERS, type SetItem, type StudySet } from './types.ts';

const TOP = new Set([
  'schema',
  'writer',
  'at',
  'source',
  'kind',
  'items',
  'title',
  'date',
  'exam',
  'planTaskId',
  'objectives',
  'focus',
  'asked',
  'createdAt',
]);
const ITEM = new Set([
  'id',
  'stem',
  'kind',
  'type',
  'options',
  'correct',
  'rationales',
  'matrix',
  'answer',
  'unit',
  'tolerance',
  'steps',
  'weakspotId',
  'objective',
  'topic',
  'cjStep',
  'verify',
  'sourceRef',
  'chapters',
  'keyPoints',
  'modelAnswer',
]);
const str = (v: unknown) => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const nonNeg = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;

function parseMatrix(id: string, m: unknown): void {
  const bad = (what: string) => new Error(`set item ${id}: bad matrix ${what}`);
  if (!isObj(m) || !strings(m.columns) || !Array.isArray(m.rows)) throw bad('shape');
  if (m.columns.length < 2 || m.columns.length > 4 || m.rows.length < 3 || m.rows.length > 6) throw bad('size');
  for (const r of m.rows) if (!isObj(r) || !str(r.text) || !nonNeg(r.correct)) throw bad('row');
}

function parseKeyPoints(id: string, k: unknown): void {
  const group = (g: unknown) => Array.isArray(g) && g.length > 0 && g.every(str);
  const point = (p: unknown) =>
    isObj(p) && str(p.text) && Array.isArray(p.keywords) && p.keywords.length > 0 && p.keywords.every(group);
  if (!(Array.isArray(k) && k.length >= 2 && k.length <= 3 && k.every(point)))
    throw new Error(`set item ${id}: bad keyPoints`);
}

function parseItem(o: unknown): SetItem {
  if (!isObj(o) || !str(o.id)) throw new Error('set item: id is required');
  const id = o.id as string;
  const bad = (what: string) => new Error(`set item ${id}: bad ${what}`);
  for (const k of Object.keys(o)) if (!ITEM.has(k)) throw new Error(`set item ${id}: unexpected field ${k}`);
  if (typeof o.stem !== 'string') throw new Error(`set item ${id}: stem is required`);
  if (o.type !== undefined && !(ITEM_TYPES as readonly unknown[]).includes(o.type)) throw bad('type');
  if (o.options !== undefined && !(strings(o.options) && o.options.length <= 6 && o.options.every(str)))
    throw bad('options');
  if (o.correct !== undefined && !(Array.isArray(o.correct) && o.correct.length > 0 && o.correct.every(nonNeg)))
    throw bad('correct');
  if (o.rationales !== undefined && !strings(o.rationales)) throw bad('rationales');
  if (o.matrix !== undefined) parseMatrix(id, o.matrix);
  if (o.answer !== undefined && typeof o.answer !== 'number') throw bad('answer');
  if (o.unit !== undefined && !str(o.unit)) throw bad('unit');
  if (o.tolerance !== undefined && !(typeof o.tolerance === 'number' && o.tolerance >= 0)) throw bad('tolerance');
  if (o.steps !== undefined && !(strings(o.steps) && o.steps.length >= 1 && o.steps.length <= 12)) throw bad('steps');
  if (o.sourceRef != null && !(typeof o.sourceRef === 'string' && /^(materials|note)\//.test(o.sourceRef)))
    throw bad('sourceRef');
  if (o.keyPoints !== undefined) parseKeyPoints(id, o.keyPoints);
  if (o.modelAnswer !== undefined && !str(o.modelAnswer)) throw bad('modelAnswer');
  return o as SetItem;
}

/** Validates a set document against the frozen ev4 schema 3; throws otherwise. Stored answers are refused. */
export function parseSet(raw: unknown): StudySet {
  if (!isObj(raw)) throw new Error('set: not an object');
  if ('answers' in raw || 'pastAttempts' in raw) throw new Error('set: answers are never stored in a set');
  for (const k of Object.keys(raw)) if (!TOP.has(k)) throw new Error(`set: unexpected field ${k}`);
  if (raw.schema !== 3) throw new Error('set: schema must be 3');
  if (!(SET_WRITERS as readonly unknown[]).includes(raw.writer)) throw new Error('set: bad writer');
  if (!str(raw.at) || !str(raw.source)) throw new Error('set: at and source are required');
  if (!(SET_KINDS as readonly unknown[]).includes(raw.kind)) throw new Error('set: bad kind');
  if (!Array.isArray(raw.items) || raw.items.length === 0) throw new Error('set: items are required');
  raw.items.forEach(parseItem);
  if (raw.date !== undefined && !(typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)))
    throw new Error('set: bad date');
  if (raw.asked !== undefined && !(Number.isInteger(raw.asked) && (raw.asked as number) >= 1))
    throw new Error('set: bad asked');
  if (raw.objectives !== undefined && !strings(raw.objectives)) throw new Error('set: bad objectives');
  return raw as StudySet;
}
