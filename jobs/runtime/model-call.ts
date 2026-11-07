// The Anthropic SDK behind ModelCall (CONTRACT §model.output). Retries are off: runStructured owns the one repair ask.
// Model ids come only from models.ts. Prompts are loaded by callers as wrangler Text modules (import of prompt.md).
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { modelInfo } from "./models.ts";
import type { Message, ModelCall } from "./output.ts";

type ModelCallOptions = {
  apiKey: string;
  /** Tests inject a fake fetch; production uses the global one. */
  fetch?: typeof fetch;
};

/**
 * The JSON Schema for output_config.format, made by the Anthropic SDK's own Zod helper (CONTRACT §model.output), which
 * rewrites a Zod schema into the subset structured output accepts. Range and format rules the subset leaves out stay
 * in the parser, which still runs on every reply.
 */
export function outputSchema(schema: z.ZodType): object {
  return zodOutputFormat(schema).schema;
}

/**
 * Prompt caching (CONTRACT §model.choice). The system prompt is one breakpoint; the first user message (the material
 * context and task, identical on the repair ask) is the second. Prompts under the model's minimum cacheable length
 * (512 tokens on Sonnet 5.5, per the Anthropic prompt-caching docs) are simply not cached, with no error.
 */
export function cachedMessages(messages: Message[]) {
  return messages.map((m, i) =>
    i === 0
      ? {
          role: m.role,
          content: [
            {
              type: "text" as const,
              text: m.content,
              cache_control: { type: "ephemeral" as const },
            },
          ],
        }
      : { role: m.role, content: m.content },
  );
}

export function sdkModelCall(opts: ModelCallOptions): ModelCall {
  const client = new Anthropic({
    apiKey: opts.apiKey,
    maxRetries: 0,
    fetch: opts.fetch,
  });
  return async (req) => {
    // Streamed: the SDK refuses a plain request when max_tokens could take over 10 minutes (found on staging).
    const res = await client.messages
      .stream({
        model: modelInfo(req.model).id,
        max_tokens: req.maxTokens,
        system: [
          {
            type: "text",
            text: req.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: cachedMessages(req.messages),
        output_config: {
          format: {
            type: "json_schema",
            schema: req.schema as Record<string, unknown>,
          },
        },
      })
      .finalMessage();
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return {
      stopReason: res.stop_reason ?? "end_turn",
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
