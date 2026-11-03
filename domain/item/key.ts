import type { Calc, Item } from './types.ts';

// A written question's key held to its own numbers and words before it is ever shown. A calculation item carries
// calc, the numbers its answer is worked from; code works the answer and drops an item whose key is not it, or whose
// options don't hold it. An item whose rationale corrects itself or names another answer is dropped too.
const MASS: Record<string, number> = { mcg: 0.001, mg: 1, g: 1000, kg: 1e6 };
const VOLUME: Record<string, number> = { ml: 1, l: 1000 };
const unitKey = (u: unknown): string =>
  String(u ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^(milligrams?|mgs)$/, 'mg')
    .replace(/^(micrograms?|µg|ug|mcgs)$/, 'mcg')
    .replace(/^(grams?|gm)$/, 'g')
    .replace(/^(kilograms?|kgs)$/, 'kg')
    .replace(/^(pounds?|lbs?)$/, 'lb')
    .replace(/^(milliliters?|millilitres?|mls)$/, 'ml')
    .replace(/^(liters?|litres?)$/, 'l');

/** A quantity from one unit to another of the same kind (mass, volume, or lb and kg); null when they don't convert. */
function convertUnit(v: number, from: unknown, to: unknown): number | null {
  const f = unitKey(from);
  const t = unitKey(to);
  if (f === t) return v;
  if (MASS[f] && MASS[t]) return (v * MASS[f]) / MASS[t];
  if (VOLUME[f] && VOLUME[t]) return (v * VOLUME[f]) / VOLUME[t];
  if (f === 'lb' && t === 'kg') return v / 2.2;
  if (f === 'kg' && t === 'lb') return v * 2.2;
  return null;
}
const num = (x: unknown): number =>
  typeof x === 'number' ? x : typeof x === 'string' && x.trim() ? Number(x) : NaN;
const has = (x: unknown): boolean => Number.isFinite(num(x));

export type Worked = { value: number; unit: string };

/**
 * The answer worked from an item's calc, or null when calc is not one E.V. can work. calc: weightKg or weightLb,
 * dosePerKg and per ('day' | 'dose') with dosesPerDay or everyHours, or dose; doseUnit; stockAmount, stockUnit and
 * stockMl (or stockForm 'tablet'); volumeMl with hours or minutes, dropFactor (gtt/mL); value, from and to for a
 * conversion; find ('daily' for the day's total).
 */
export function calcAnswer(c: Calc | null | undefined): Worked | null {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  if (has(c.value) && c.from && c.to) {
    const v = convertUnit(num(c.value), c.from, c.to);
    return v == null ? null : { value: v, unit: unitKey(c.to) };
  }
  if (has(c.volumeMl) && (has(c.minutes) || has(c.hours)) && !has(c.dosePerKg) && !has(c.dose)) {
    const mins = has(c.minutes) ? num(c.minutes) : num(c.hours) * 60;
    if (!(mins > 0)) return null;
    return has(c.dropFactor)
      ? { value: (num(c.volumeMl) * num(c.dropFactor)) / mins, unit: 'gtt/min' }
      : { value: num(c.volumeMl) / (mins / 60), unit: 'ml/hr' };
  }
  let amount: number | null = null;
  const unit = unitKey(c.doseUnit || 'mg');
  if (has(c.dosePerKg)) {
    const kg = has(c.weightKg) ? num(c.weightKg) : has(c.weightLb) ? num(c.weightLb) / 2.2 : NaN;
    if (!Number.isFinite(kg)) return null;
    amount = kg * num(c.dosePerKg);
    if (String(c.per || 'dose').toLowerCase() === 'day' && c.find !== 'daily') {
      const n = has(c.dosesPerDay) ? num(c.dosesPerDay) : has(c.everyHours) ? 24 / num(c.everyHours) : NaN;
      if (!(n > 0)) return null;
      amount /= n;
    }
  } else if (has(c.dose)) amount = num(c.dose);
  if (amount == null) return null;
  if (has(c.stockAmount) && (has(c.stockMl) || c.stockForm === 'tablet')) {
    const a = convertUnit(amount, unit, c.stockUnit || unit);
    if (a == null || !(num(c.stockAmount) > 0)) return null;
    return c.stockForm === 'tablet' && !has(c.stockMl)
      ? { value: a / num(c.stockAmount), unit: 'tablets' }
      : { value: (a / num(c.stockAmount)) * num(c.stockMl), unit: 'ml' };
  }
  return { value: amount, unit };
}

const NUMBER = /(-?\d[\d,]*(?:\.\d+)?|-?\.\d+)\s*([a-zA-Zµ/]+)?/;
type OptionNumber = { value: number; decimals: number; unit: string | null };
/** An option's number and unit ("150 mg", "5.8 mL", "1,000"); null when it holds no number. */
function optionNumber(text: unknown): OptionNumber | null {
  const m = String(text ?? '').match(NUMBER);
  if (!m) return null;
  const raw = (m[1] ?? '').replace(/,/g, '');
  const dot = raw.indexOf('.');
  return { value: Number(raw), decimals: dot < 0 ? 0 : raw.length - dot - 1, unit: m[2] || null };
}
/** The worked value as the option states it: equal at the option's own precision; a whole number off by rounding
 *  holds only within 2% (20.8 gtt/min is 21; 5.83 mL is not 6). */
function sameAtPrecision(v: number, o: OptionNumber): boolean {
  const shown = Number(v.toFixed(o.decimals));
  if (Math.abs(shown - o.value) > 1e-9) return false;
  return o.decimals > 0 || Math.abs(o.value - v) <= 0.02 * Math.abs(v) + 1e-9;
}
const optionIn = (o: OptionNumber, unit: string): number => {
  if (!o.unit) return o.value;
  const v = convertUnit(o.value, o.unit, unit);
  return v == null ? o.value : v;
};
// a question that asks for a worked number: a weight-based order, mL per dose, a rate or drops per minute
const CALC_WORDS =
  /\b(?:mg|mcg|g|units?)\s*\/\s*kg\b|\b(?:mL|ml)\s*\/\s*(?:hr|h|hour)\b|\bgtt\b|\bdrops?\s*(?:\/|per)\s*min|\bdrop factor\b|\bhow many\s+(?:mL|milliliters?|tablets?|capsules?|mg|mcg|units|gtt|drops)\b|\bsingle dose\b|\bper dose\b|\bdivided\s+(?:every|q\s*\d)|\bevery\s+\d+\s+hours\b[^.?]*\b(?:mg|mL)\b|\b\d+(?:\.\d+)?\s*(?:mg|mcg|g)\s*(?:\/|per|in)\s*\d*(?:\.\d+)?\s*mL\b/i;

/** Whether an item asks for a worked number: numbers in a dose or rate stem with numeric options or a numeric answer. */
function looksLikeCalc(q: Item): boolean {
  if (!/\d/.test(q.stem || '') || !CALC_WORDS.test(q.stem || '')) return false;
  if (q.type === 'numeric') return true;
  const o = Array.isArray(q.options) ? q.options : [];
  return o.length >= 2 && o.filter((x) => optionNumber(x)).length >= Math.ceil(o.length / 2);
}
// only what a model writes when it catches itself, at a sentence's start: "Wait, ...", "Hmm", "Oops", "Let me recheck"
const SELF_CORRECTS = /(?:^|[.!?;:]\s+|\(\s*)(?:wait\s*[,—–-]|hmm+\b|oops\b|let me (?:re-?)?check\b)/i;
// the key's own rationale calling itself wrong ("this answer is incorrect"), never "the other options are incorrect"
const SAYS_WRONG = /\bthis (?:answer|option|choice)\s+(?:is|would be)\s+(?:wrong|incorrect|not correct|not right)\b/i;
const NAMES_ANSWER =
  /\b(?:correct|right)\s+(?:answer|dose|choice|option|amount)\s+(?:is|would be|should be|=)\s*:?\s*/gi;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const flat = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Why an item's rationale disagrees with its key, or null: one corrects itself, the key's own says it is wrong, one
 *  says the key is wrong, or one names another option as the answer. */
function rationaleProblem(q: Item): string | null {
  const opts = Array.isArray(q.options) ? q.options.map(flat) : [];
  const key = Array.isArray(q.correct) ? q.correct : [];
  const rats = [
    ...(Array.isArray(q.rationales) ? q.rationales : []),
    ...((q.matrix && Array.isArray(q.matrix.rows) && q.matrix.rows.map((r) => r && r.rationale)) || []),
    ...(Array.isArray(q.steps) ? q.steps : []),
  ].map(flat);
  if (rats.some((r) => SELF_CORRECTS.test(r))) return 'a rationale corrects itself';
  if (!opts.length || !key.length) return null;
  for (const k of key) {
    const own = Array.isArray(q.rationales) ? flat(q.rationales[k]) : '';
    if (SAYS_WRONG.test(own)) return 'the key’s own rationale calls it wrong';
    const t = opts[k];
    if (t && t.length <= 60 && rats.some((r) => new RegExp(esc(t) + '\\s+(?:is|would be)\\s+(?:wrong|incorrect)').test(r)))
      return 'a rationale says the key is wrong';
  }
  for (const r of rats)
    for (const m of r.matchAll(NAMES_ANSWER)) {
      const after = r.slice((m.index ?? 0) + m[0].length).replace(/^["'“‘(]+/, '');
      const named = opts
        .map((t, i): [string, number] => [t, i])
        .filter(([t]) => t && after.startsWith(t))
        .sort((a, b) => b[0].length - a[0].length)[0];
      if (named && !key.includes(named[1])) return 'a rationale names another option as the answer';
    }
  return null;
}

// what a stem already written may never hold: its answer said ("Answer: 37.5 mg", "the correct answer is B"), a
// solution or rationale written into it, or its key repeated after the question
const SAYS_ANSWER =
  /\banswers?\s*(?:is\s*)?[:=]|\b(?:correct|right)\s+(?:answer|option|choice)\s+(?:is|would be|=)\b|\b(?:solution|working|worked (?:answer|solution)|rationale|explanation)\s*:/i;

/** Why a question's stem gives its answer away, or null: the check every runner holds a stored question to before it
 *  is shown. It never asks that the stem be phrased as a question, so an older question only goes when it shows its answer. */
export function stemGivesAway(q: Item | null | undefined): string | null {
  if (!q || typeof q !== 'object' || q.type === 'open') return null;
  const stem = String(q.stem || '');
  if (SAYS_ANSWER.test(stem)) return 'its stem gives its answer away';
  const opts = Array.isArray(q.options) ? q.options : [];
  const key = q.type !== 'matrix' && Array.isArray(q.correct) ? q.correct : [];
  // the key's own words after the question ("Which vitamin builds collagen? (Vitamin C)")
  const tail = flat(stem.slice(stem.lastIndexOf('?') + 1));
  const holds = (t: string) => t.length >= 4 && new RegExp('(?:^|\\W)' + esc(t) + '(?:\\W|$)').test(tail);
  if (stem.includes('?') && key.some((i) => holds(flat(opts[i])))) return 'its stem gives its answer away';
  const keys: { value: number; unit: string | null }[] =
    q.type === 'numeric'
      ? typeof q.answer === 'number'
        ? [{ value: q.answer, unit: q.unit || null }]
        : []
      : key.map((i) => optionNumber(opts[i])).filter((o): o is OptionNumber => !!o);
  const said = [...stem.matchAll(new RegExp(NUMBER.source, 'g'))].map((m) => ({
    value: Number((m[1] ?? '').replace(/,/g, '')),
    unit: m[2] ? unitKey(m[2]) : null,
  }));
  for (const k of keys)
    if (k.unit && said.some((n) => n.unit === unitKey(k.unit) && Math.abs(n.value - k.value) < 1e-9))
      return 'its stem gives its answer away';
  return null;
}

const ASKS =
  /\?|:\s*$|\b(?:calculate|compute|determine|how (?:many|much|long|often)|what|which|who|when|where|why|select|choose|identify|indicate|find|give|round|match|classify|explain|describe|list)\b/i;
const WORKED = /\banswers?\s*(?:is\s*)?[:=]|=\s*-?\.?\d/i;
/** Why a stem is no fair question, or null: it asks nothing, shows its working, or states its numeric key. */
function stemProblem(q: Item): string | null {
  const stem = String(q.stem || '');
  if (!ASKS.test(stem)) return 'its stem asks no question';
  if (WORKED.test(stem)) return 'its stem gives its answer away';
  return stemGivesAway(q);
}

/** Why a written item can't be trusted, or null when it can: its stem, its rationale disagrees with its key, its calc
 *  works to another answer (or to none of its options), or it asks for a worked number and carries no calc. */
export function answerKeyProblem(q: Item | null | undefined): string | null {
  if (!q || typeof q !== 'object') return 'not an object';
  const st = stemProblem(q);
  if (st) return st;
  const r = rationaleProblem(q);
  if (r) return r;
  const work = q.calc ? calcAnswer(q.calc) : null;
  if (q.calc && !work) return 'its calc can’t be worked';
  if (!work) return looksLikeCalc(q) ? 'a calculation with no calc to check its key' : null;
  if (q.type === 'numeric') {
    if (typeof q.answer !== 'number') return null; // validateItem refuses it
    const v = (q.unit ? convertUnit(work.value, work.unit, q.unit) : null) ?? work.value;
    const tol = typeof q.tolerance === 'number' ? q.tolerance : 0;
    const o = optionNumber(String(q.answer)) as OptionNumber;
    return Math.abs(q.answer - v) <= tol + 1e-9 || sameAtPrecision(v, o)
      ? null
      : `its answer ${q.answer} is not the worked ${+v.toFixed(2)}`;
  }
  const opts = Array.isArray(q.options) ? q.options : [];
  const nums = opts.map(optionNumber);
  if (!nums.some(Boolean)) return null; // options in words (safe or not): no number to hold the key to
  const off = (i: number) => Math.abs(optionIn(nums[i] as OptionNumber, work.unit) - work.value);
  const hits = nums
    .map((o, i) => (o && sameAtPrecision(work.value, { ...o, value: optionIn(o, work.unit) }) ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => off(a) - off(b));
  const shown = +work.value.toFixed(2) + ' ' + work.unit.replace('ml', 'mL');
  if (!hits.length) return `no option is the worked answer (${shown})`;
  const key = Array.isArray(q.correct) ? q.correct : [];
  return key.includes(hits[0] as number) && (q.type === 'sata' || key.length === 1)
    ? null
    : `its key is not the worked answer (${shown})`;
}
