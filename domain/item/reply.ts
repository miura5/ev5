import { withObjective } from '../objective/index.ts';
import { answerKeyProblem } from './key.ts';
import { ITEM_CONFIG, norm, type Item, type ItemConfig } from './types.ts';

// A model's practice questions drift from the asked shape in ways that keep their meaning ("correct": 0 for [0], a
// letter or the option's own words, "Analyze Cues", options as {text}); validateItem refuses each. These mend only
// what can be read one way; anything else is left for validateItem to refuse.
type Loose = Record<string, any>;
const slug = (s: unknown) => norm(s).replace(/ /g, '-');
const TYPE_ALIASES: Record<string, string> = {
  single: 'single',
  'multiple-choice': 'single',
  mcq: 'single',
  'single-answer': 'single',
  'single-choice': 'single',
  sata: 'sata',
  'select-all': 'sata',
  'select-all-that-apply': 'sata',
  'multiple-response': 'sata',
  'multi-select': 'sata',
  matrix: 'matrix',
  'matrix-grid': 'matrix',
  grid: 'matrix',
  numeric: 'numeric',
  open: 'open',
};

/** One answer index as written: a whole number as it is; a string as the choice's own words, else "2" (from 0), else
 *  a letter (A is 0); null when unreadable, and null when a reading as words and one as an index or letter name
 *  different choices (options O, A, B, AB with "A"; options 3, 8, 12, 15 with "3"): a dropped question beats a
 *  wrongly keyed one. */
function answerIndex(x: unknown, choices: unknown[]): number | null {
  if (Number.isInteger(x)) return x as number; // the asked shape: an index, as written
  if (typeof x !== 'string') return null;
  const s = x.trim();
  // the exact words first; then the words folded for case, spacing and trailing punctuation, symbols kept (↑ and ↓,
  // > and <, Rh+ and Rh- stay apart), and only when they name one choice: anything else is refused, never guessed
  const named = (same: (c: string | number) => boolean) =>
    choices.flatMap((c, i) => ((typeof c === 'string' || typeof c === 'number') && same(c) ? [i] : []));
  const fold = (t: unknown) =>
    String(t)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[.,;:!?]+$/, '');
  let hits = named((c) => String(c).trim() === s);
  if (!hits.length && fold(s)) hits = named((c) => fold(c) === fold(s));
  if (hits.length > 1) return null;
  const byText = hits[0] ?? -1;
  let byPlace: number | null = null;
  if (/^\d+$/.test(s)) byPlace = Number(s);
  else if (/^[A-Fa-f]$/.test(s)) byPlace = s.toUpperCase().charCodeAt(0) - 65;
  if (byPlace != null && byPlace >= choices.length) byPlace = null;
  if (byText >= 0) return byPlace == null || byPlace === byText ? byText : null;
  return byPlace;
}

// the fields a stored item may hold (sets schema 3's items allow no other)
export const ITEM_KEYS = [
  'id',
  'kind',
  'type',
  'stem',
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
];
const keep = (o: Loose, keys: string[]): Loose =>
  Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

/** A question as the model wrote it, mended where its shape drifted without changing what it says, holding only the
 *  fields a stored item may (an extra key would refuse the set's write). */
export function normalizeItem(raw: unknown, cfg: ItemConfig = ITEM_CONFIG, nursing?: boolean): any {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const q: Loose = { ...raw };
  if (!q.stem)
    for (const k of ['question', 'q', 'prompt']) if (typeof q[k] === 'string' && q[k].trim()) q.stem = q[k];
  if (typeof q.type === 'string' && TYPE_ALIASES[slug(q.type)]) q.type = TYPE_ALIASES[slug(q.type)];
  // options as {text} read as their words; a number option stays a number, so validateItem still refuses it
  if (Array.isArray(q.options))
    q.options = q.options.map((o) => (o && typeof o === 'object' ? (o.text ?? o.label ?? o.option ?? o) : o));
  const opts: unknown[] = Array.isArray(q.options) ? q.options : [];
  if (q.correct != null && q.type !== 'numeric' && q.type !== 'open' && q.type !== 'matrix') {
    const c = Array.isArray(q.correct) ? q.correct : [q.correct];
    const idx = c.map((x) => answerIndex(x, opts));
    if (idx.every((i) => i != null)) q.correct = idx;
  }
  if (q.type === 'matrix' && q.matrix && typeof q.matrix === 'object' && Array.isArray(q.matrix.rows)) {
    const cols: unknown[] = Array.isArray(q.matrix.columns) ? q.matrix.columns : [];
    q.matrix = {
      ...keep(q.matrix, ['columns']),
      rows: q.matrix.rows.map((r: Loose) => {
        if (!r || typeof r !== 'object') return r;
        const c = Array.isArray(r.correct) && r.correct.length === 1 ? r.correct[0] : r.correct;
        const i = answerIndex(c, cols);
        return keep(i == null ? r : { ...r, correct: i }, ['text', 'correct', 'rationale']);
      }),
    };
  }
  if (q.type === 'numeric') {
    for (const k of ['answer', 'tolerance'])
      if (typeof q[k] === 'string' && q[k].trim() && Number.isFinite(Number(q[k]))) q[k] = Number(q[k]);
  }
  if (nursing === false) delete q.cjStep; // only a nursing course keeps a clinical-judgment step
  else if (typeof q.cjStep === 'string') {
    const s = slug(q.cjStep);
    if (cfg.cjSteps.includes(s)) q.cjStep = s;
    else if (cfg.cjSteps.length) delete q.cjStep; // a step it could not name is no step, not a refused question
  }
  // a sourceRef the sets schema would refuse (it must start materials/ or note/) is left off, so one bad ref never
  // loses the whole set's write; a valid one stays as written
  if (q.sourceRef !== undefined && !(typeof q.sourceRef === 'string' && /^(materials|note)\//.test(q.sourceRef)))
    delete q.sourceRef;
  return keep(q, ITEM_KEYS);
}

/** The questions in a practice reply: {items}, a bare array, {questions} or {set: {items}}. */
export function replyItems(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== 'object') return [];
  const r = res as Loose;
  for (const v of [r.items, r.questions, r.set && r.set.items]) if (Array.isArray(v)) return v;
  return [];
}

/** A practice reply's items as they are kept before they are checked: mended, ids m1, m2..., a weak spot id not in the
 *  record (or any, for a set of new checks) left off, the objective held (a spot's own when it has one, else the
 *  candidates), kind review or check. A key its own numbers or rationale don't support is dropped while its calc is
 *  still on it. */
export function tagItems(
  res: unknown,
  opts: { ids?: string[]; spots?: { id: string; objective?: string }[]; checks?: boolean; type?: string; nursing?: boolean } = {},
): any[] {
  const { ids = [], spots = [], checks = false, type, nursing } = opts;
  return replyItems(res)
    .map((raw) => {
      const q = normalizeItem(raw, ITEM_CONFIG, nursing);
      return q && typeof q === 'object' && !Array.isArray(q) && answerKeyProblem({ ...q, calc: (raw as Loose).calc })
        ? null
        : q;
    })
    .map((q, i) => {
      if (!q || typeof q !== 'object' || Array.isArray(q)) return q;
      const item: Loose = { ...q, id: 'm' + (i + 1), ...(type ? { type } : {}) };
      const spot = !checks && item.weakspotId ? spots.find((w) => w && w.id === item.weakspotId) : null;
      if (!spot) delete item.weakspotId;
      const tagged = spot && spot.objective ? { ...item, objective: spot.objective } : withObjective(item, ids);
      return { ...tagged, kind: spot ? 'review' : 'check' };
    });
}

/** The whole questions of a reply cut short (at max_tokens) or wrapped in words: each complete object inside its items
 *  array (else the first array), parsed one by one; a question cut mid-way is left out. */
export function salvageItems(text: unknown): unknown[] {
  const t = String(text ?? '');
  const k = t.search(/"(?:items|questions)"\s*:\s*\[/);
  let i = k >= 0 ? t.indexOf('[', k) : t.indexOf('[');
  if (i < 0) return [];
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (i = i + 1; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') {
      if (depth === 0 && ch === '{') start = i;
      depth++;
    } else if (ch === '}' || ch === ']') {
      if (depth === 0) break; // the items array closed
      depth--;
      if (depth === 0 && ch === '}' && start >= 0) {
        try {
          out.push(JSON.parse(t.slice(start, i + 1)));
        } catch {
          // a question that does not parse is left out
        }
        start = -1;
      }
    }
  }
  return out;
}

/** A set short of the count it was asked for says so in its header: "9 of 10: 1 didn’t pass E.V.’s checks". */
export function setShortfall(set: { asked?: number; items?: Item[] } | null | undefined, held?: number): string {
  const asked = set && Number.isInteger(set.asked) ? (set.asked as number) : 0;
  const n = held == null ? (set && Array.isArray(set.items) ? set.items.length : 0) : held;
  return asked > n ? `${n} of ${asked}: ${asked - n} didn’t pass E.V.’s checks` : '';
}
