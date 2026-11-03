// The study plan job (CONTRACT §job.study-plan, §job.kinds): starts only from Matt's tap, never from chat words.
// Steps: gather (code only), draft (one Sonnet call), approve (needs you), save. Dates and the weak-spot order are code
// in domain (§cmd.code-first); the model only arranges them into tasks. The model call and the store are injected.
import { defineJob } from '../runtime/define.ts';
import { checkCitations, runStructured, type ModelCall } from '../runtime/output.ts';
import type { StepHandlers } from '../runtime/workflow.ts';
import { addDays, examDaysLeft, type Exam } from '../../domain/index.ts';

export const MODEL = 'sonnet';
export const MAX_TOKENS = 8000;
export const COST_CAP_CENTS = 60;
const MAX_DAYS = 28;
const MAX_DAY_MINUTES = 180;
const MAX_TASKS = 80;

export type StudyPlanInput = { examId: string };
export type Decision = {
  decision: 'approve' | 'put_away' | 'change';
  note?: string;
};
export type Task = {
  date: string;
  title: string;
  minutes: number;
  weakSpotId?: string;
};
export type Plan = { summary: string; tasks: Task[] };
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
const text = (v: unknown, what: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`${what}: needs 1 to ${max} characters`);
  return v;
};

export function parseInput(raw: unknown): StudyPlanInput {
  return { examId: text(rec(raw, 'study plan input').examId, 'examId', 128) };
}

export function parseDecision(raw: unknown): Decision {
  const d = rec(raw, 'answer').decision;
  if (d !== 'approve' && d !== 'put_away') throw new Error('answer: decision must be approve or put_away');
  return { decision: d };
}

/** The continuation from `approve`: a change request (decision 'change' plus Matt's note) or an approve/put away. */
export function parseAnswer(raw: unknown): Decision {
  const o = rec(raw, 'answer');
  if (o.decision !== 'change') return parseDecision(raw);
  return { decision: 'change', note: text(o.note, 'note', 2000) };
}

export function parsePlan(raw: unknown): Plan {
  const o = rec(raw, 'plan');
  if (!Array.isArray(o.tasks)) throw new Error('plan: tasks must be a list');
  const tasks = o.tasks.map((t, i): Task => {
    const x = rec(t, `task ${i + 1}`);
    if (typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) throw new Error(`task ${i + 1}: bad date`);
    if (!Number.isInteger(x.minutes) || (x.minutes as number) < 10 || (x.minutes as number) > 120)
      throw new Error(`task ${i + 1}: minutes must be a whole number from 10 to 120`);
    const base = {
      date: x.date,
      title: text(x.title, `task ${i + 1} title`),
      minutes: x.minutes as number,
    };
    return x.weakSpotId == null
      ? base
      : {
          ...base,
          weakSpotId: text(x.weakSpotId, `task ${i + 1} weakSpotId`, 128),
        };
  });
  return { summary: text(o.summary, 'summary', 400), tasks };
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

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'tasks'],
  properties: {
    summary: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'title', 'minutes'],
        properties: {
          date: { type: 'string' },
          title: { type: 'string' },
          minutes: { type: 'integer' },
          weakSpotId: { type: 'string' },
        },
      },
    },
  },
};

export const studyPlanJob = defineJob({
  kind: 'study_plan',
  title: 'Study plan',
  input: parseInput,
  output: parsePlan,
  model: MODEL,
  maxTokens: MAX_TOKENS,
  costCapCents: COST_CAP_CENTS,
  steps: ['gather', 'draft', 'approve', 'revise', 'save'],
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
        schema: PLAN_SCHEMA,
        parse: parsePlan,
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
    revise: async (c) => {
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
    },
    save: async (c) => {
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
