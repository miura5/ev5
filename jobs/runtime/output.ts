// Structured model output (CONTRACT §model.output): stop-reason check, parse, semantic checks, one repair ask, then fail.
// The model call is injected, so tests need no network. The SDK behind it runs with maxRetries: 0.
import { costCents, modelInfo, type Usage } from './models.ts';
import type { Parser } from './define.ts';

export type Message = { role: 'user' | 'assistant'; content: string };
export type ModelRequest = {
  model: string;
  system: string;
  messages: Message[];
  maxTokens: number;
  /** JSON Schema for output_config.format. */
  schema: object;
};
export type ModelReply = { stopReason: string; text: string; usage: Usage };
export type ModelCall = (req: ModelRequest) => Promise<ModelReply>;

export type StructuredSpec<O> = {
  call: ModelCall;
  /** A key into models.ts. */
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  schema: object;
  parse: Parser<O>;
  /** Semantic checks; returns problems in plain words, empty when fine. */
  check?: (value: O) => string[];
};

export type StructuredResult<O> =
  | { ok: true; value: O; repaired: boolean; costCents: number }
  | { ok: false; reason: string; costCents: number };

/** A model call that threw after earlier calls of the same ask were billed: carries what was spent. */
export class ModelCallError extends Error {
  readonly costCents: number;
  constructor(cause: unknown, costCents: number) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.costCents = costCents;
  }
}

/**
 * Runs the work after a reservation. If it throws, the step's hold is settled at what was billed (0 releases it), so
 * a failed attempt never leaves money reserved. The original error is rethrown.
 */
export async function billedOnThrow<T>(
  spend: (cents: number) => Promise<void>,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (e) {
    try {
      await spend(e instanceof ModelCallError ? e.costCents : 0);
    } catch {
      // the next attempt's reserve releases a hold that is still open
    }
    throw e;
  }
}

/**
 * Keeps a paid model result: a put that throws is tried again here, with the result still in memory, so a write that
 * never landed does not send the step back to the model (which would bill it twice). The last error is rethrown.
 */
export async function putKept<T>(put: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await put();
    } catch (e) {
      if (i >= tries) throw e;
    }
  }
}

/** Plain-words problems for ids cited that were not in the excerpts given. */
export function checkCitations(cited: Iterable<string>, given: Iterable<string>): string[] {
  const allowed = new Set(given);
  return [...new Set(cited)]
    .filter((id) => !allowed.has(id))
    .map((id) => `The answer cites "${id}", which was not in the excerpts.`);
}

function problems<O>(text: string, spec: StructuredSpec<O>): { value: O } | { errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { errors: ['The reply was not valid JSON.'] };
  }
  let value: O;
  try {
    value = spec.parse(raw);
  } catch (e) {
    return {
      errors: [e instanceof Error ? e.message : 'The reply did not match the expected shape.'],
    };
  }
  const errors = spec.check?.(value) ?? [];
  return errors.length ? { errors } : { value };
}

export async function runStructured<O>(spec: StructuredSpec<O>): Promise<StructuredResult<O>> {
  const cap = modelInfo(spec.model).maxOutputTokens;
  if (spec.maxTokens > cap) throw new Error(`maxTokens ${spec.maxTokens} is over the model's limit of ${cap}.`);
  let spent = 0;
  const messages: Message[] = [{ role: 'user', content: spec.prompt }];
  for (let attempt = 0; attempt < 2; attempt++) {
    let reply: ModelReply;
    try {
      reply = await spec.call({
        model: spec.model,
        system: spec.system,
        messages,
        maxTokens: spec.maxTokens,
        schema: spec.schema,
      });
    } catch (e) {
      throw new ModelCallError(e, spent);
    }
    spent += costCents(spec.model, reply.usage);
    if (reply.stopReason === 'max_tokens')
      return {
        ok: false,
        reason: 'The model ran out of room before it finished its answer.',
        costCents: spent,
      };
    if (reply.stopReason === 'refusal')
      return {
        ok: false,
        reason: 'The model declined to answer this request.',
        costCents: spent,
      };
    const r = problems(reply.text, spec);
    if ('value' in r)
      return {
        ok: true,
        value: r.value,
        repaired: attempt > 0,
        costCents: spent,
      };
    if (attempt === 1)
      return {
        ok: false,
        reason: `The answer was still not usable after one fix attempt: ${r.errors.join(' ')}`,
        costCents: spent,
      };
    messages.push(
      { role: 'assistant', content: reply.text },
      {
        role: 'user',
        content: `Your answer had these problems: ${r.errors.join(' ')} Reply again with corrected JSON only.`,
      },
    );
  }
  throw new Error('unreachable');
}
