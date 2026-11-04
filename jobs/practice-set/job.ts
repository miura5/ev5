// The practice set job (CONTRACT §job.kinds): a set of questions grounded in course excerpts, with the mock exam as a
// variant. Items with no source are drafts, and "Write with E.V." makes every item a draft (PLAN §6.4).
// The model call is injected, so tests need no network; the model id and price come from jobs/runtime/models.ts.
import { z } from 'zod';
import { checkCitations, defineJob, runStructured, type ModelCall } from '../runtime/index.ts';
import { parseWith } from '../runtime/define.ts';
import { outputSchema } from '../runtime/model-call.ts';

export const VARIANTS = ['practice', 'mock_exam'] as const;
export const MAX_ITEMS = { practice: 30, mock_exam: 75 } as const;

const nonBlank = (what: string) => z.string().refine((t) => t.trim().length > 0, `${what} must not be empty.`);
const textList = (what: string) => z.array(nonBlank(what), { error: `${what} must be a list of text.` });

const ExcerptSchema = z.object(
  { id: z.string().min(1), text: z.string() },
  { error: 'An excerpt needs an id and text.' },
);
export const InputSchema = z
  .object(
    {
      variant: z.enum(VARIANTS, {
        error: 'variant must be practice or mock_exam.',
      }),
      /** Where the items land: a set id. */
      targetId: z.string({ error: 'targetId is required.' }).min(1, 'targetId is required.'),
      count: z.number({ error: 'count must be a whole number.' }).int('count must be a whole number.'),
      objectives: textList('objectives').default([]),
      excerpts: z.array(ExcerptSchema).default([]),
      /** "Write with E.V.": every item is a draft to keep or drop. */
      drafts: z.boolean().default(false),
    },
    { error: 'The request must be an object.' },
  )
  .superRefine((v, ctx) => {
    const max = MAX_ITEMS[v.variant];
    if (v.count < 1 || v.count > max)
      ctx.addIssue({
        code: 'custom',
        path: ['count'],
        message: `count must be 1 to ${max} for ${v.variant}.`,
      });
  });
// The JSON Schema sent to the model comes from this one schema; semantic rules (counts, citations) are checkItems.
export const ItemSchema = z.object({
  stem: nonBlank('stem'),
  type: z.enum(['single', 'sata'], { error: 'type must be single or sata.' }),
  options: textList('options'),
  correct: z.array(z.number().int(), {
    error: 'correct must be a list of option numbers.',
  }),
  rationales: textList('rationales'),
  objective: z.string().optional(),
  sourceRef: z.string().nullable(),
});
export const OutputSchema = z.object(
  { items: z.array(ItemSchema).refine((a) => a.length > 0, '"items" must be a non-empty list.') },
  { error: 'The answer must be an object.' },
);

export type PracticeInput = z.infer<typeof InputSchema>;
export type PracticeItem = z.infer<typeof ItemSchema>;
export type PracticeOutput = z.infer<typeof OutputSchema>;
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

export const parseInput = parseWith(InputSchema);

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

export const practiceSet = defineJob({
  kind: 'practice_set',
  title: 'Practice set',
  input: InputSchema,
  output: OutputSchema,
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
    schema: outputSchema(OutputSchema),
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
