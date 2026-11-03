import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { outputSchema, sdkModelCall } from './model-call.ts';
import { MODELS } from './models.ts';

function fake(status: number, body: unknown) {
  const calls: { url: string; body: any }[] = [];
  const f = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const ok = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: MODELS.haiku.id,
  content: [{ type: 'text', text: '{"a":1}' }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: null },
};
const req = {
  model: 'haiku',
  system: 's',
  messages: [{ role: 'user' as const, content: 'p' }],
  maxTokens: 100,
  schema: outputSchema(z.object({ a: z.number() })),
};

test('sends the registry id and the schema, maps the reply', async () => {
  const { f, calls } = fake(200, ok);
  const r = await sdkModelCall({ apiKey: 'k', fetch: f })(req);
  assert.equal(calls[0]!.body.model, MODELS.haiku.id);
  assert.equal(calls[0]!.body.output_config.format.type, 'json_schema');
  assert.equal(calls[0]!.body.output_config.format.schema.additionalProperties, false);
  assert.equal(calls[0]!.body.output_config.format.schema.$schema, undefined);
  assert.deepEqual(r, {
    stopReason: 'end_turn',
    text: '{"a":1}',
    usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 0 },
  });
});

test('no retries: a 529 is called once and throws', async () => {
  const { f, calls } = fake(529, { type: 'error', error: { type: 'overloaded_error', message: 'busy' } });
  await assert.rejects(sdkModelCall({ apiKey: 'k', fetch: f })(req));
  assert.equal(calls.length, 1);
});

test('an unknown model key is refused before any call', async () => {
  const { f, calls } = fake(200, ok);
  await assert.rejects(sdkModelCall({ apiKey: 'k', fetch: f })({ ...req, model: 'gpt' }), /Unknown model/);
  assert.equal(calls.length, 0);
});
