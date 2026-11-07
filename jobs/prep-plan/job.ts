// The prep plan job (CONTRACT §job.prep-plan, §job.kinds): starts only from Matt's tap, never from chat words.
// Steps: gather (code only), draft (one Sonnet call), approve (needs you), save. Dates and the weak-spot order are code
// in domain (§cmd.code-first); the model only arranges them into tasks. The model call and the store are injected.
import { z } from 'zod';
import { defineJob, parseWith } from '../runtime/define.ts';
import { NonRetryableError } from '../runtime/non-retryable.ts';
import { outputSchema } from '../runtime/model-call.ts';
import { billedOnThrow, checkCitations, runStructured, type ModelCall } from '../runtime/output.ts';
import type { StepHandlers } from '../runtime/workflow.ts';
import { addDays, goalDaysLeft, kindOffers, planBodySchema, type Goal, type PlanBody, type PlanTask } from '../../domain/index.ts';

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

export const InputSchema = z.object({ goalId: text('goalId', 128) }, { error: 'prep plan input: not an object' });
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
export type Task = PlanTask;
export type Plan = PlanBody;
export type PlanSpot = { id: string; title: string; need: number };
export type PlanContext = {
  goal: { id: string; title: string; kind: Goal['kind']; date: string };
  today: string;
  days: string[];
  weakSpots: PlanSpot[];
};

/** Where plan content lives (D1 in production). Keyed by job id, so a retried step writes the same row. */
export interface PlanStore {
  /** The goal (a dated goal, read as an exam document) and its active weak spots as of `today` (Central date). */
  load(goalId: string): Promise<{ exam: Goal & { id: string }; spots: PlanSpot[]; today: string } | undefined>;
  putContext(jobId: string, ctx: PlanContext): Promise<string>;
  getContext(jobId: string): Promise<PlanContext>;
  putDraft(jobId: string, plan: Plan): Promise<string>;
  getDraft(jobId: string): Promise<Plan>;
  /** The draft if the draft step already stored it (its step result was lost), else undefined. */
  findDraft?(jobId: string): Promise<Plan | undefined>;
  /** A model failure noted once, so a step retry does not pay for the same failing call again. */
  /** Approve: the plan's tasks go onto Today. Put away: the draft is kept, marked put away. Returns the plan id. */
  approve(jobId: string, plan: Plan): Promise<string>;
  putAway(jobId: string): Promise<string>;
}

const rec = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what}: not an object`);
  return v as Record<string, unknown>;
};

export const parseInput = parseWith(InputSchema);
export const parsePlan = parseWith(planBodySchema);
export const parseDecision = parseWith(DecisionSchema) as (raw: unknown) => Decision;

/** The continuation from `approve`: a change request (decision 'change' plus Matt's note) or an approve/put away. */
export function parseAnswer(raw: unknown): Decision {
  return rec(raw, 'answer').decision === 'change' ? parseWith(ChangeSchema)(raw) : parseDecision(raw);
}

/** Why a date gets no prep plan: its kind does not offer one. */
export function noPlanReason(title: string): string {
  return `${title} has no prep plan: a date of this kind does not offer one. Change its kind to plan it.`;
}

/** The deterministic part: the days from today to the day before the goal's date (at most 28), weak spots worst first. */
export function buildContext(found: NonNullable<Awaited<ReturnType<PlanStore['load']>>>): PlanContext {
  const { exam, spots, today } = found;
  // The registry says which kinds of date offer a prep plan (domain/goal); the job never checks a kind by name.
  if (!kindOffers(exam.kind, 'prep-plan')) throw new Error(noPlanReason(exam.title));
  const left = goalDaysLeft(exam, today);
  if (left === null || !exam.date)
    throw new Error(`${exam.title} has no date yet, so there is nothing to plan toward.`);
  if (left < 1) throw new Error(`${exam.title} is today or past, so a prep plan no longer fits.`);
  const days = Array.from({ length: Math.min(left, MAX_DAYS) }, (_, i) => addDays(today, i));
  const weakSpots = [...spots].sort((a, b) => b.need - a.need || a.title.localeCompare(b.title));
  return {
    goal: { id: exam.id, title: exam.title, kind: exam.kind, date: exam.date },
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
  const dates = [...new Set(plan.tasks.map((t) => t.date))];
  // Plain ISO dates compare as text. A past day is refused by name; the goal's day and later are outside ctx.days.
  const past = dates.filter((d) => d < ctx.today);
  if (past.length) out.push(`These dates have already passed: ${past.join(', ')}. Start from ${ctx.today}.`);
  const bad = dates.filter((d) => !days.has(d) && !past.includes(d));
  if (bad.length) out.push(`These dates are not plan days: ${bad.join(', ')}.`);
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

/** Change rounds on one draft. Each round is its own step so its continuation id (`jobId-step-round`) is new (§job.needs-you). */
export const MAX_CHANGE_ROUNDS = 5;
export const REVISE_STEPS = Array.from({ length: MAX_CHANGE_ROUNDS }, (_, i) =>
  i === 0 ? 'revise' : `revise_${i + 1}`,
);

export const prepPlanJob = defineJob({
  kind: 'prep_plan',
  title: 'Prep plan',
  input: InputSchema,
  output: planBodySchema,
  model: MODEL,
  maxTokens: MAX_TOKENS,
  costCapCents: COST_CAP_CENTS,
  steps: ['gather', 'draft', 'approve', ...REVISE_STEPS, 'save'],
  wording: {
    running: 'E.V. is building your prep plan.',
    needsYou: 'Your prep plan is ready. Approve it or put it away.',
    done: 'Your prep plan is saved.',
    failed: 'The prep plan could not be made.',
  },
  startedBy: ['matt'],
  executor: 'workflow',
  answer: (raw) => parseAnswer(raw),
  // One model call and a save: a plan that has not moved in half an hour is not coming back.
  deadlineMinutes: { queued: 15, running: 30 },
});

export type Deps = {
  store: PlanStore;
  call: ModelCall;
  system: string;
  changesSystem?: string;
  /** plan.ask_changes (changes.ts); passed in because changes.ts imports this file. */
  askChanges?: (
    d: { call: ModelCall; system: string },
    input: { draft: Plan; ctx: PlanContext; note: string },
  ) => Promise<{ ok: true; plan: Plan; costCents: number } | { ok: false; reason: string; costCents: number }>;
};

export function prepPlanHandlers({ store, call, system, changesSystem, askChanges }: Deps): StepHandlers {
  const revise: StepHandlers[string] = async (c) => {
    const a = parseAnswer(c.input);
    if (a.decision !== 'change') return { ids: [] };
    if (!changesSystem || !askChanges) throw new Error('Changing a plan is not set up on this Worker.');
    // The days were fixed when the first draft was made; a change round rebuilds them from the day it runs.
    const found = await store.load((await store.getContext(c.jobId)).goal.id);
    if (!found) throw new Error('That date was not found.');
    const ctx = buildContext(found);
    await store.putContext(c.jobId, ctx);
    await c.reserve(COST_CAP_CENTS);
    const r = await billedOnThrow(c.spend, async () =>
      askChanges(
        { call, system: changesSystem },
        { draft: await store.getDraft(c.jobId), ctx, note: a.note! },
      ),
    );
    await c.spend(r.costCents);
    if (!r.ok) throw new NonRetryableError(r.reason);
    await store.putDraft(c.jobId, r.plan);
    return {
      needsYou: `Your prep plan for ${ctx.goal.title} was changed. Approve it or put it away.`,
    };
  };

  return {
    gather: async (c) => {
      const found = await store.load(parseInput(c.input).goalId);
      if (!found) throw new Error('That date was not found.');
      return { ids: [await store.putContext(c.jobId, buildContext(found))] };
    },
    draft: async (c) => {
      // The draft is already kept (a retry after the write landed): the model is not paid for again.
      if (await store.findDraft?.(c.jobId)) return { ids: [`${c.jobId}:draft`] };
      const ctx = await store.getContext(c.jobId);
      await c.reserve(COST_CAP_CENTS);
      const r = await billedOnThrow(c.spend, async () =>
        runStructured({
          call,
          model: MODEL,
          system,
          prompt: JSON.stringify(ctx),
          maxTokens: MAX_TOKENS,
          schema: outputSchema(planBodySchema),
          parse: prepPlanJob.output,
          check: (p) => checkPlan(p, ctx),
        }),
      );
      await c.spend(r.costCents);
      if (!r.ok) throw new NonRetryableError(r.reason);
      return { ids: [await store.putDraft(c.jobId, r.value)] };
    },
    approve: async (c) => {
      const ctx = await store.getContext(c.jobId);
      return {
        needsYou: `Your prep plan for ${ctx.goal.title} is ready. Approve it or put it away.`,
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
