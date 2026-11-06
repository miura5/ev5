import test from "node:test";
import assert from "node:assert/strict";
import { gradeAnswer, gradePrompt, GRADE_SYSTEM } from "./grade.ts";
import type { ModelCall } from "../runtime/output.ts";

const usage = { inputTokens: 100, outputTokens: 20 };
const reply = (text: string): ModelCall => async () => ({ stopReason: "end_turn", text, usage });
const i = { question: "Why?", reference: "Because.", answer: "Since." };

test("a valid grade comes back with its cost", async () => {
  const r = await gradeAnswer(reply('{"score":0.5,"note":"Half."}'), i);
  assert.ok(r.ok && r.grade.score === 0.5 && r.costCents > 0);
});

test("a score outside 0 to 1 is asked again once, then fails", async () => {
  let n = 0;
  const call: ModelCall = async () => (n++, { stopReason: "end_turn", text: '{"score":4,"note":"x"}', usage });
  const r = await gradeAnswer(call, i);
  assert.equal(r.ok, false);
  assert.equal(n, 2);
});

test("the prompt carries the three parts and names no subject", () => {
  const p = gradePrompt(i);
  assert.match(p, /Question: Why\?/);
  assert.match(p, /Student answer: Since\./);
  assert.doesNotMatch(GRADE_SYSTEM + p, /nurs|NUR|BIO/i);
});
