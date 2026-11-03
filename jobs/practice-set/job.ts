// The practice set job (CONTRACT §job.kinds): a set of questions grounded in course excerpts, with the mock exam as a
// variant. Items with no source are drafts, and "Write with E.V." makes every item a draft (PLAN §6.4).
// The model call is injected, so tests need no network; the model id and price come from jobs/runtime/models.ts.
import { checkCitations, defineJob, runStructured, type ModelCall } from '../runtime/index.ts';

export const VARIANTS = ['practice', 'mock_exam'] as const;
export const MAX_ITEMS = { practice: 30, mock_exam: 75 } as const;

export type Excerpt = { id: string; text: string };
export type PracticeInput = {
  variant: (typeof VARIANTS)[number];
  /** Where the items land: a set id. */
  targetId: string;
  count: number;
  objectives: string[];
  excerpts: Excerpt[];
  /** "Write with E.V.": every item is a draft to keep or drop. */
  drafts: boolean;
};
export type PracticeItem = {
  stem: string;
  type: 'single' | 'sata';
  options: string[];
  correct: number[];
  rationales: string[];
  objective?: string;
  sourceRef: string | null;
};
export type PracticeOutput = { items: PracticeItem[] };
export type DraftRow = {
  jobId: string;
  kind: 'set-item';
  targetC: string;
  targetId: string;
  body: PracticeItem;
};
export type PracticeResult =
  | {
      ok: true;
      items: PracticeItem[];
      drafts: DraftRow[];
      needsYou: boolean;
      costCents: number;
      repaired: boolean;
    }
  | { ok: false; reason: string; costCents: number };

const obj = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what} must be an object.`);
  return v as Record<string, unknown>;
};
const strs = (v: unknown, what: string): string[] => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !x.trim()))
    throw new Error(`${what} must be a list of text.`);
  return v as string[];
};

export function parseInput(raw: unknown): PracticeInput {
  const o = obj(raw, 'The request');
  const variant = (VARIANTS as readonly unknown[]).includes(o.variant) ? (o.variant as PracticeInput['variant']) : null;
  if (!variant) throw new Error('variant must be practice or mock_exam.');
  if (typeof o.targetId !== 'string' || !o.targetId) throw new Error('targetId is required.');
  if (!Number.isInteger(o.count) || (o.count as number) < 1 || (o.count as number) > MAX_ITEMS[variant])
    throw new Error(`count must be 1 to ${MAX_ITEMS[variant]} for ${variant}.`);
  const excerpts = (Array.isArray(o.excerpts) ? o.excerpts : []).map((e) => {
    const x = obj(e, 'An excerpt');
    if (typeof x.id !== 'string' || !x.id || typeof x.text !== 'string')
      throw new Error('An excerpt needs an id and text.');
    return { id: x.id, text: x.text };
  });
  return {
    variant,
    targetId: o.targetId,
    count: o.count as number,
    objectives: strs(o.objectives ?? [], 'objectives'),
    excerpts,
    drafts: o.drafts === true,
  };
}

export function parseOutput(raw: unknown): PracticeOutput {
  const items = obj(raw, 'The answer').items;
  if (!Array.isArray(items) || items.length === 0) throw new Error('"items" must be a non-empty list.');
  return {
    items: items.map((it, n) => {
      const q = obj(it, `Item ${n + 1}`);
      const at = `Item ${n + 1}`;
      if (typeof q.stem !== 'string' || !q.stem.trim()) throw new Error(`${at} needs a stem.`);
      if (q.type !== 'single' && q.type !== 'sata') throw new Error(`${at} type must be single or sata.`);
      const options = strs(q.options, `${at} options`);
      const rationales = strs(q.rationales, `${at} rationales`);
      if (!Array.isArray(q.correct) || q.correct.some((i) => !Number.isInteger(i)))
        throw new Error(`${at} correct must be a list of option numbers.`);
      const sourceRef = q.sourceRef ?? null;
      if (sourceRef !== null && typeof sourceRef !== 'string') throw new Error(`${at} sourceRef must be text or null.`);
      return {
        stem: q.stem,
        type: q.type,
        options,
        correct: q.correct as number[],
        rationales,
        ...(typeof q.objective === 'string' ? { objective: q.objective } : {}),
        sourceRef,
      };
    }),
  };
}

/** Plain-words problems with the items themselves; the citation check is added by the caller. */
export function checkItems(out: PracticeOutput, count: number): string[] {
  const bad: string[] = [];
  if (out.items.length !== count) bad.push(`Expected ${count} items but got ${out.items.length}.`);
  out.items.forEach((q, n) => {
    const at = `Item ${n + 1}`;
    if (q.options.length < 2) bad.push(`${at} needs at least two options.`);
    if (q.rationales.length !== q.options.length) bad.push(`${at} needs one rationale per option.`);
    const right = new Set(q.correct);
    if (right.size !== q.correct.length || q.correct.some((i) => i < 0 || i >= q.options.length))
      bad.push(`${at} correct points at options that do not exist.`);
    else if (q.type === 'single' ? right.size !== 1 : right.size < 2)
      bad.push(`${at} is ${q.type} but has ${right.size} right option${right.size === 1 ? '' : 's'}.`);
  });
  return bad;
}

export const practiceSet = defineJob<PracticeInput, PracticeOutput>({
  kind: 'practice_set',
  title: 'Practice set',
  input: parseInput,
  output: parseOutput,
  model: 'haiku',
  maxTokens: 32_000,
  costCapCents: 50,
  steps: ['plan', 'call', 'save'],
  wording: {
    running: 'E.V. is writing your questions.',
    needsYou: 'Some questions have no source. Keep or drop each one.',
    done: 'Your questions are ready.',
    failed: 'E.V. could not finish the questions.',
  },
  startedBy: ['matt'],
  executor: 'workflow',
});

const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['stem', 'type', 'options', 'correct', 'rationales', 'sourceRef'],
  properties: {
    stem: { type: 'string' },
    type: { enum: ['single', 'sata'] },
    options: { type: 'array', items: { type: 'string' } },
    correct: { type: 'array', items: { type: 'integer' } },
    rationales: { type: 'array', items: { type: 'string' } },
    objective: { type: 'string' },
    sourceRef: { type: ['string', 'null'] },
  },
} as const;
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: { items: { type: 'array', items: ITEM_SCHEMA } },
} as const;

/** The user message: what to write and the only excerpts that may be cited. */
export function buildPrompt(input: PracticeInput): string {
  const head =
    input.variant === 'mock_exam'
      ? `Write a mock exam of ${input.count} questions.`
      : `Write ${input.count} practice questions.`;
  const objectives = input.objectives.length
    ? `Objectives:\n${input.objectives.map((o) => `- ${o}`).join('\n')}`
    : 'No objectives were named; cover the excerpts.';
  const excerpts = input.excerpts.map((e) => `[${e.id}]\n${e.text}`).join('\n\n');
  return `${head}\n\n${objectives}\n\nExcerpts:\n\n${excerpts || '(none)'}`;
}

/** Runs the call step: the model writes the items, then they are checked and split into set items and drafts. */
export async function writePracticeSet(
  jobId: string,
  rawInput: unknown,
  deps: { call: ModelCall; system: string },
): Promise<PracticeResult> {
  const input = practiceSet.input(rawInput);
  const r = await runStructured<PracticeOutput>({
    call: deps.call,
    model: practiceSet.model,
    system: deps.system,
    prompt: buildPrompt(input),
    maxTokens: practiceSet.maxTokens,
    schema: OUTPUT_SCHEMA,
    parse: practiceSet.output,
    check: (v) => [
      ...checkItems(v, input.count),
      ...checkCitations(
        v.items.flatMap((q) => (q.sourceRef === null ? [] : [q.sourceRef])),
        input.excerpts.map((e) => e.id),
      ),
    ],
  });
  if (!r.ok) return r;
  const toDraft = (q: PracticeItem): DraftRow => ({
    jobId,
    kind: 'set-item',
    targetC: input.drafts ? 'own_sets' : 'sets',
    targetId: input.targetId,
    body: q,
  });
  const sourced = r.value.items.filter((q) => q.sourceRef !== null);
  const unsourced = r.value.items.filter((q) => q.sourceRef === null);
  const toDrafts = input.drafts ? r.value.items : unsourced;
  return {
    ok: true,
    items: input.drafts ? [] : sourced,
    drafts: toDrafts.map(toDraft),
    needsYou: toDrafts.length > 0,
    costCents: r.costCents,
    repaired: r.repaired,
  };
}
