// defineJob (CONTRACT §job.define): a job kind's whole contract in one validated, frozen object.
import { z } from 'zod';

export type Parser<T> = (raw: unknown) => T;

/**
 * Parses with a Zod schema and throws one plain-words Error listing every problem (CONTRACT §model.output). The text
 * is shown to Matt (a 400) and sent back to the model on the repair ask, so a path leads each problem that has one.
 */
export function parseWith<T>(schema: z.ZodType<T>): Parser<T> {
  return (raw) => {
    const r = schema.safeParse(raw);
    if (r.success) return r.data;
    throw new Error(
      r.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; '),
    );
  };
}
export type Starter = 'matt' | 'schedule' | 'mac';
export type ExecutorKind = 'workflow' | 'cron' | 'mac';

export type JobSpec<I, O> = {
  kind: string;
  title: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
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

/** `input` and `output` parse (throwing plain words); `inputSchema` and `outputSchema` are the Zod schemas behind them. */
export type JobDef<I = unknown, O = unknown> = Readonly<
  Omit<JobSpec<I, O>, 'input' | 'output'> & {
    inputSchema: z.ZodType<I>;
    outputSchema: z.ZodType<O>;
    input: Parser<I>;
    output: Parser<O>;
  }
>;

const KINDS = new Set<string>();

export function defineJob<I, O>(spec: JobSpec<I, O>): JobDef<I, O> {
  const bad = (m: string): never => {
    throw new Error(`defineJob ${spec.kind || '(no kind)'}: ${m}`);
  };
  if (!/^[a-z][a-z0-9_]*$/.test(spec.kind)) bad('kind must be lower_snake_case');
  if (KINDS.has(spec.kind)) bad('kind is already defined');
  if (!spec.title.trim()) bad('title is required');
  if (!(spec.input instanceof z.ZodType) || !(spec.output instanceof z.ZodType))
    bad('input and output need Zod schemas');
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
  const { input, output, ...rest } = spec;
  return Object.freeze({
    ...rest,
    inputSchema: input,
    outputSchema: output,
    input: parseWith(input),
    output: parseWith(output),
    steps: Object.freeze([...spec.steps]),
    startedBy: Object.freeze([...spec.startedBy]),
  });
}

/** Test helper: lets a test file define the same kind twice. */
export const forgetKinds = (): void => KINDS.clear();
