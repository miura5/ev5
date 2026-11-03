// The Anthropic SDK behind ModelCall (CONTRACT §model.output). Retries are off: runStructured owns the one repair ask.
// Model ids come only from models.ts. Prompts are loaded by callers as wrangler Text modules (import of prompt.md).
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { modelInfo } from './models.ts';
import type { ModelCall } from './output.ts';

type ModelCallOptions = {
  apiKey: string;
  /** Tests inject a fake fetch; production uses the global one. */
  fetch?: typeof fetch;
};

/** The JSON Schema for output_config.format, derived from a Zod schema (no $schema key). */
export function outputSchema(schema: z.ZodType): object {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

export function sdkModelCall(opts: ModelCallOptions): ModelCall {
  const client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 0, fetch: opts.fetch });
  return async (req) => {
    const res = await client.messages.create({
      model: modelInfo(req.model).id,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages,
      output_config: { format: { type: 'json_schema', schema: req.schema as Record<string, unknown> } },
    });
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return {
      stopReason: res.stop_reason ?? 'end_turn',
      text,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
      },
    };
  };
}
