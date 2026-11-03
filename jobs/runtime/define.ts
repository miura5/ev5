// defineJob (CONTRACT §job.define): a job kind's whole contract in one validated, frozen object.
export type Parser<T> = (raw: unknown) => T;
export type Starter = 'matt' | 'schedule' | 'mac';
export type ExecutorKind = 'workflow' | 'cron' | 'mac';

export type JobSpec<I, O> = {
  kind: string;
  title: string;
  input: Parser<I>;
  output: Parser<O>;
  /** A key into models.ts; ids and prices never appear here. */
  model: string;
  maxTokens: number;
  costCapCents: number;
  steps: readonly string[];
  /** Plain words Activity shows for each state. */
  wording: { running: string; needsYou: string; done: string; failed: string };
  startedBy: readonly Starter[];
  executor: ExecutorKind;
};

export type JobDef<I = unknown, O = unknown> = Readonly<JobSpec<I, O>>;

const KINDS = new Set<string>();

export function defineJob<I, O>(spec: JobSpec<I, O>): JobDef<I, O> {
  const bad = (m: string): never => {
    throw new Error(`defineJob ${spec.kind || '(no kind)'}: ${m}`);
  };
  if (!/^[a-z][a-z0-9_]*$/.test(spec.kind)) bad('kind must be lower_snake_case');
  if (KINDS.has(spec.kind)) bad('kind is already defined');
  if (!spec.title.trim()) bad('title is required');
  if (typeof spec.input !== 'function' || typeof spec.output !== 'function') bad('input and output need parsers');
  if (!spec.model) bad('model is required');
  if (!Number.isInteger(spec.maxTokens) || spec.maxTokens <= 0) bad('maxTokens must be a positive integer');
  if (!Number.isInteger(spec.costCapCents) || spec.costCapCents <= 0) bad('costCapCents must be a positive integer');
  if (
    spec.steps.length === 0 ||
    new Set(spec.steps).size !== spec.steps.length ||
    spec.steps.some((s) => s.includes(':'))
  )
    bad('steps must be unique, non-empty and contain no colon');
  if (!spec.startedBy.length) bad('startedBy needs at least one starter');
  for (const k of ['running', 'needsYou', 'done', 'failed'] as const)
    if (!spec.wording[k].trim()) bad(`wording.${k} is empty`);
  KINDS.add(spec.kind);
  return Object.freeze({
    ...spec,
    steps: Object.freeze([...spec.steps]),
    startedBy: Object.freeze([...spec.startedBy]),
  });
}

/** Test helper: lets a test file define the same kind twice. */
export const forgetKinds = (): void => KINDS.clear();
