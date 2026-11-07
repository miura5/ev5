import { test } from "vitest";
import assert from "node:assert/strict";
import { z } from "zod";
import { outputSchema, sdkModelCall } from "./model-call.ts";
import { MODELS } from "./models.ts";

function fake(status: number, body: unknown) {
  const calls: { url: string; body: any }[] = [];
  const f = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (status !== 200)
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    const m = body as any;
    const ev = (t: string, d: unknown) =>
      `event: ${t}\ndata: ${JSON.stringify({ type: t, ...(d as object) })}\n\n`;
    const sse =
      ev("message_start", {
        message: {
          ...m,
          content: [],
          stop_reason: null,
          usage: { ...m.usage, output_tokens: 0 },
        },
      }) +
      ev("content_block_start", {
        index: 0,
        content_block: { type: "text", text: "" },
      }) +
      ev("content_block_delta", {
        index: 0,
        delta: { type: "text_delta", text: m.content[0].text },
      }) +
      ev("content_block_stop", { index: 0 }) +
      ev("message_delta", {
        delta: { stop_reason: m.stop_reason, stop_sequence: null },
        usage: { output_tokens: m.usage.output_tokens },
      }) +
      ev("message_stop", {});
    return new Response(sse, {
      status,
      headers: { "content-type": "text/event-stream" },
    });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const ok = {
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: MODELS.haiku.id,
  content: [{ type: "text", text: '{"a":1}' }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    cache_read_input_tokens: 2,
    cache_creation_input_tokens: null,
  },
};
const req = {
  model: "haiku",
  system: "s",
  messages: [{ role: "user" as const, content: "p" }],
  maxTokens: 100,
  schema: outputSchema(z.object({ a: z.number() })),
};

test("sends the registry id and the schema, maps the reply", async () => {
  const { f, calls } = fake(200, ok);
  const r = await sdkModelCall({ apiKey: "k", fetch: f })(req);
  assert.equal(calls[0]!.body.model, MODELS.haiku.id);
  assert.equal(calls[0]!.body.output_config.format.type, "json_schema");
  assert.equal(
    calls[0]!.body.output_config.format.schema.additionalProperties,
    false,
  );
  assert.equal(calls[0]!.body.output_config.format.schema.$schema, undefined);
  assert.deepEqual(r, {
    stopReason: "end_turn",
    text: '{"a":1}',
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 2,
      cacheWriteTokens: 0,
    },
  });
});

test("no retries: a 529 is called once and throws", async () => {
  const { f, calls } = fake(529, {
    type: "error",
    error: { type: "overloaded_error", message: "busy" },
  });
  await assert.rejects(sdkModelCall({ apiKey: "k", fetch: f })(req));
  assert.equal(calls.length, 1);
});

test("an unknown model key is refused before any call", async () => {
  const { f, calls } = fake(200, ok);
  await assert.rejects(
    sdkModelCall({ apiKey: "k", fetch: f })({ ...req, model: "gpt" }),
    /Unknown model/,
  );
  assert.equal(calls.length, 0);
});

test("marks the system prompt and the first user message with cache_control; the repair turn is plain", async () => {
  const { f, calls } = fake(200, ok);
  await sdkModelCall({ apiKey: "k", fetch: f })({
    ...req,
    messages: [
      { role: "user", content: "p" },
      { role: "assistant", content: "a" },
      { role: "user", content: "fix" },
    ],
  });
  const b = calls[0]!.body;
  assert.deepEqual(b.system, [
    { type: "text", text: "s", cache_control: { type: "ephemeral" } },
  ]);
  assert.deepEqual(b.messages[0].content, [
    { type: "text", text: "p", cache_control: { type: "ephemeral" } },
  ]);
  assert.equal(b.messages[1].content, "a");
  assert.equal(b.messages[2].content, "fix");
});

test("outputSchema comes from the SDK helper: no $schema key, integers kept, objects closed", () => {
  const s = outputSchema(
    z.object({ n: z.number().int(), xs: z.array(z.object({ t: z.string() })) }),
  ) as Record<string, any>;
  assert.equal(s.$schema, undefined);
  assert.equal(s.additionalProperties, false);
  assert.equal(s.properties.n.type, "integer");
  assert.equal(s.properties.xs.items.additionalProperties, false);
});
