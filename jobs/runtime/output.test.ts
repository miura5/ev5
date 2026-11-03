import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCitations, runStructured, type ModelCall, type ModelReply } from './output.ts';
import { costCents, modelsStaleWarning, MODELS } from './models.ts';

const usage = { inputTokens: 1000, outputTokens: 500 };
const parse = (r: unknown): { ids: string[] } => {
  const o = r as { ids?: unknown };
  if (!Array.isArray(o?.ids)) throw new Error('"ids" must be a list.');
  return { ids: o.ids as string[] };
};
const script = (...replies: Partial<ModelReply>[]) => {
  const seen: number[] = [];
  const call: ModelCall = async (req) => {
    seen.push(req.messages.length);
    return { stopReason: 'end_turn', text: '{}', usage, ...replies.shift() };
  };
  return { call, seen };
};
const base = (call: ModelCall) => ({
  call,
  model: 'haiku',
  system: 's',
  prompt: 'p',
  maxTokens: 1000,
  schema: {},
  parse,
  check: (v: { ids: string[] }) => checkCitations(v.ids, ['a', 'b']),
});

test('valid output lands', async () => {
  const { call } = script({ text: '{"ids":["a"]}' });
  const r = await runStructured(base(call));
  assert.ok(r.ok && !r.repaired && r.value.ids[0] === 'a');
});

test('invalid output gets one repair ask, then fails in plain words', async () => {
  const { call, seen } = script({ text: 'nope' }, { text: '{"ids":"x"}' });
  const r = await runStructured(base(call));
  assert.deepEqual(seen, [1, 3]);
  assert.ok(!r.ok && /still not usable/.test(r.reason) && /"ids" must be a list/.test(r.reason));
  assert.ok(r.costCents > 0);
});

test('a repair can succeed; bad citations are caught', async () => {
  const { call } = script({ text: '{"ids":["zzz"]}' }, { text: '{"ids":["b"]}' });
  const r = await runStructured(base(call));
  assert.ok(r.ok && r.repaired);
});

test('max_tokens and refusal fail at once without a repair', async () => {
  for (const [stopReason, re] of [
    ['max_tokens', /ran out of room/],
    ['refusal', /declined/],
  ] as const) {
    const { call, seen } = script({ stopReason, text: '{"ids":[' });
    const r = await runStructured(base(call));
    assert.ok(!r.ok && re.test(r.reason));
    assert.equal(seen.length, 1);
  }
});

test('maxTokens over the model limit throws', async () => {
  await assert.rejects(runStructured({ ...base(script().call), maxTokens: 999_999 }));
});

test('cost and staleness', () => {
  assert.equal(costCents('sonnet', { inputTokens: 1_000_000, outputTokens: 1_000_000 }), 1200);
  assert.equal(costCents('haiku', { inputTokens: 200_000, outputTokens: 0 }), 10);
  assert.equal(MODELS.haiku.id, 'claude-haiku-5-5');
  assert.equal(modelsStaleWarning(new Date('2026-11-10')), null);
  assert.match(modelsStaleWarning(new Date('2027-06-01')) ?? '', /last checked/);
});
