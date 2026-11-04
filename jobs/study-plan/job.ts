// The study plan job (CONTRACT §job.study-plan, §job.kinds): starts only from Matt's tap, never from chat words.
// Steps: gather (code only), draft (one Sonnet call), approve (needs you), save. Dates and the weak-spot order are code
// in domain (§cmd.code-first); the model only arranges them into tasks. The model call and the store are injected.
import { z } from 'zod';
import { defineJob, parseWith } from '../runtime/define.ts';
import { outputSchema } from '../runtime/model-call.ts';
import { checkCitations, runStructured, type ModelCall } from '../runtime/output.ts';
import type { StepHandlers } from '../runtime/workflow.ts';
import { addDays, examDaysLeft, type Exam } from '../../domain/index.ts';

export const MODEL = 'sonnet';
export const MAX_TOKENS = 8000;
export const COST_CAP_CENTS = 60;
const MAX_DAYS = 28;
const MAX_DAY_MINUTES = 180;
const MAX_TASKS = 80;

// One schema each for what the model writes and what the app sends. Ranges and formats are refinements, so the JSON
// Schema sent to the model stays within what structured output supports; checkPlan holds the semantic rules.
const text = (what: string, max = 200) =>
  z
    .string({ error: `${what}: needs 1 to ${max} characters` })
    .refine((t) => t.trim().length > 0 && t.length <= max, `${what}: needs 1 to ${max} characters`);

export const InputSchema = z.object({ examId: text('examId', 128) }, { error: 'study plan input: not an object' });
const TaskSchema = z.object({
  date: z.string().refine((d) => /^\d{4}-\d{2}-\d{2}$/.test(d), 'bad date'),
  title: text('title'),
  minutes: z
    .number()
    .int()
    .refine((m) => m >= 10 && m <= 120, 'minutes must be a whole number from 10 to 120'),
  weakSpotId: text('weakSpotId', 128).optional(),
});
export const PlanSchema = z.object(
  {
    summary: text('summary', 400),
    tasks: z.array(TaskSchema, { error: 'tasks must be a list' }),
  },
  { error: 'plan: not an object' },
);
const DecisionSchema = z.object({
  decision: z.enum(['approve', 'put_away'], {
    error: 'decision must be approve or put_away',
  }),
});
const ChangeSchema = z.object({
  decision: z.literal('change'),
  note: text('note', 2000),
});

export type Decision = {
  decision: 'approve' | 'put_away' | 'change';
  note?: string;
};
export type Task = z.infer<typeof TaskSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type PlanSpot = { id: string; title: string; need: number };
export type PlanContext = {
  exam: { id: string; title: string; kind: Exam['kind']; date: string };
  today: string;
  days: string[];
  weakSpots: PlanSpot[];
};

/** Where plan content lives (D1 in production). Keyed by job id, so a retried step writes the same row. */
export interface PlanStore {
  /** The exam and its active weak spots as of `today` (Central date). */
  load(examId: string): Promise<{ exam: Exam & { id: string }; spots: PlanSpot[]; today: string } | undefined>;
  putContext(jobId: string, ctx: PlanContext): Promise<string>;
  getContext(jobId: string): Promise<PlanContext>;
  putDraft(jobId: string, plan: Plan): Promise<string>;
  getDraft(jobId: string): Promise<Plan>;
  /** A model failure noted once, so a step retry does not pay for the same failing call again. */
  putFailure(jobId: string, reason: string): Promise<void>;
  getFailure(jobId: string): Promise<string | undefined>;
  /** Approve: the plan's tasks go onto Today. Put away: the draft is kept, marked put away. Returns the plan id. */
  approve(jobId: string, plan: Plan): Promise<string>;
  putAway(jobId: string): Promise<string>;
}

const rec = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what}: not an object`);
  return v as Record<string, unknown>;
};

export const parseInput = parseWith(InputSchema);
export const parsePlan = parseWith(PlanSchema);
export const parseDecision = parseWith(DecisionSchema) as (raw: unknown) => Decision;

/** The continuation from `approve`: a change request (decision 'change' plus Matt's note) or an approve/put away. */
export function parseAnswer(raw: unknown): Decision {
  return rec(raw, 'answer').decision === 'change' ? parseWith(ChangeSchema)(raw) : parseDecision(raw);
}

/** The deterministic part: study days from today to the day before the exam (at most 28), weak spots worst first. */
export function buildContext(found: NonNullable<Awaited<ReturnType<PlanStore['load']>>>): PlanContext {
  const { exam, spots, today } = found;
  const left = examDaysLeft(exam, today);
  if (left === null || !exam.date)
    throw new Error(`${exam.title} has no date yet, so there is nothing to plan toward.`);
  if (left < 1) throw new Error(`${exam.title} is today or past, so a study plan no longer fits.`);
  const days = Array.from({ length: Math.min(left, MAX_DAYS) }, (_, i) => addDays(today, i));
  const weakSpots = [...spots].sort((a, b) => b.need - a.need || a.title.localeCompare(b.title));
  return {
    exam: { id: exam.id, title: exam.title, kind: exam.kind, date: exam.date },
    today,
    days,
    weakSpots,
  };
}

/** Semantic checks in plain words: dates inside the window, cited spots real, no day over the cap. */
export function checkPlan(plan: Plan, ctx: PlanContext): string[] {
  const out: string[] = [];
  if (!plan.tasks.length) out.push('The plan has no tasks.');
  if (plan.tasks.length > MAX_TASKS) out.push(`The plan has more than ${MAX_TASKS} tasks.`);
  const days = new Set(ctx.days);
  const bad = [...new Set(plan.tasks.map((t) => t.date).filter((d) => !days.has(d)))];
  if (bad.length) out.push(`These dates are not study days: ${bad.join(', ')}.`);
  const per = new Map<string, number>();
  for (const t of plan.tasks) per.set(t.date, (per.get(t.date) ?? 0) + t.minutes);
  for (const [d, m] of per) if (m > MAX_DAY_MINUTES) out.push(`${d} has ${m} minutes; the most is ${MAX_DAY_MINUTES}.`);
  const cited = plan.tasks.flatMap((t) => (t.weakSpotId ? [t.weakSpotId] : []));
  return [
    ...out,
    ...checkCitations(
      cited,
      ctx.weakSpots.map((w) => w.id),
    ),
  ];
}

/** Change rounds on one draft. Each round is its own step so its continuation id (`jobId:step`) is new (§job.needs-you). */
export const MAX_CHANGE_ROUNDS = 5;
export const REVISE_STEPS = Array.from({ length: MAX_CHANGE_ROUNDS }, (_, i) =>
  i === 0 ? 'revise' : `revise_${i + 1}`,
);

export const studyPlanJob = defineJob({
  kind: 'study_plan',
  title: 'Study plan',
  input: InputSchema,
  output: PlanSchema,
  model: MODEL,
  maxTokens: MAX_TOKENS,
  costCapCents: COST_CAP_CENTS,
  steps: ['gather', 'draft', 'approve', ...REVISE_STEPS, 'save'],
  wording: {
    running: 'E.V. is building your study plan.',
    needsYou: 'Your study plan is ready. Approve it or put it away.',
    done: 'Your study plan is saved.',
    failed: 'The study plan could not be made.',
  },
  startedBy: ['matt'],
  executor: 'workflow',
});

export type Deps = {
  store: PlanStore;
  call: ModelCall;
  system: string;
  changesSystem?: string;
  /** studyplan.ask_changes (changes.ts); passed in because changes.ts imports this file. */
  askChanges?: (
    d: { call: ModelCall; system: string },
    input: { draft: Plan; ctx: PlanContext; note: string },
  ) => Promise<{ ok: true; plan: Plan; costCents: number } | { ok: false; reason: string; costCents: number }>;
};

export function studyPlanHandlers({ store, call, system, changesSystem, askChanges }: Deps): StepHandlers {
  const revise: StepHandlers[string] = async (c) => {
    const a = parseAnswer(c.input);
    if (a.decision !== 'change') return { ids: [] };
    if (!changesSystem || !askChanges) throw new Error('Changing a plan is not set up on this Worker.');
    const failed = await store.getFailure(c.jobId);
    if (failed) throw new Error(failed);
    const ctx = await store.getContext(c.jobId);
    await c.reserve(COST_CAP_CENTS);
    const r = await askChanges(
      { call, system: changesSystem },
      { draft: await store.getDraft(c.jobId), ctx, note: a.note! },
    );
    await c.spend(r.costCents);
    if (!r.ok) {
      await store.putFailure(c.jobId, r.reason);
      throw new Error(r.reason);
    }
    await store.putDraft(c.jobId, r.plan);
    return {
      needsYou: `Your study plan for ${ctx.exam.title} was changed. Approve it or put it away.`,
    };
  };

  return {
    gather: async (c) => {
      const found = await store.load(parseInput(c.input).examId);
      if (!found) throw new Error('That exam was not found.');
      return { ids: [await store.putContext(c.jobId, buildContext(found))] };
    },
    draft: async (c) => {
      const earlier = await store.getFailure(c.jobId);
      if (earlier) throw new Error(earlier);
      const ctx = await store.getContext(c.jobId);
      await c.reserve(COST_CAP_CENTS);
      const r = await runStructured({
        call,
        model: MODEL,
        system,
        prompt: JSON.stringify(ctx),
        maxTokens: MAX_TOKENS,
        schema: outputSchema(PlanSchema),
        parse: studyPlanJob.output,
        check: (p) => checkPlan(p, ctx),
      });
      await c.spend(r.costCents);
      if (!r.ok) {
        await store.putFailure(c.jobId, r.reason);
        throw new Error(r.reason);
      }
      return { ids: [await store.putDraft(c.jobId, r.value)] };
    },
    approve: async (c) => {
      const ctx = await store.getContext(c.jobId);
      return {
        needsYou: `Your study plan for ${ctx.exam.title} is ready. Approve it or put it away.`,
      };
    },
    ...Object.fromEntries(REVISE_STEPS.map((name) => [name, revise])),
    save: async (c) => {
      const answer = rec(c.input, 'answer');
      if (answer.decision === 'change')
        throw new Error(`A plan can be changed ${MAX_CHANGE_ROUNDS} times. Approve it or put it away.`);
      const { decision } = parseDecision(c.input);
      return {
        ids: [
          decision === 'approve'
            ? await store.approve(c.jobId, await store.getDraft(c.jobId))
            : await store.putAway(c.jobId),
        ],
      };
    },
  };
}
