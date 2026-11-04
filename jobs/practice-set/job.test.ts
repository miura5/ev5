import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ModelCall, ModelReply } from "../runtime/index.ts";
import { MODELS } from "../runtime/models.ts";
import { outputSchema } from "../runtime/model-call.ts";
import {
  buildPrompt,
  parseInput,
  parsePublicInput,
  practiceSet,
  writePracticeSet,
} from "./job.ts";

const system = readFileSync(new URL("./prompt.md", import.meta.url), "utf8");
const usage = { inputTokens: 2000, outputTokens: 1000 };
const q = (sourceRef: string | null, over: object = {}) => ({
  stem: "Which action is first?",
  type: "single",
  options: ["a", "b", "c", "d"],
  correct: [1],
  rationales: ["w", "r", "w", "w"],
  sourceRef,
  ...over,
});
const input = (over: object = {}) => ({
  variant: "practice",
  targetId: "set-1",
  count: 2,
  objectives: ["Vital signs"],
  excerpts: [{ id: "e1", text: "Pulse is measured..." }],
  drafts: false,
  ...over,
});
const script = (...replies: Partial<ModelReply>[]) => {
  const reqs: Parameters<ModelCall>[0][] = [];
  const call: ModelCall = async (req) => {
    reqs.push(req);
    return { stopReason: "end_turn", text: "{}", usage, ...replies.shift() };
  };
  return { call, reqs };
};
const reply = (items: unknown[]): Partial<ModelReply> => ({
  text: JSON.stringify({ items }),
});

test("the job is defined with a models.ts key and the 32,000-token budget", () => {
  assert.equal(practiceSet.kind, "practice_set");
  assert.ok(practiceSet.model in MODELS);
  assert.equal(practiceSet.maxTokens, 32_000);
});

test("sourced items become set items; unsourced ones become drafts and need you", async () => {
  const { call, reqs } = script(reply([q("e1"), q(null)]));
  const r = await writePracticeSet("job-1", input(), { call, system });
  assert.ok(r.ok);
  assert.equal(r.items.length, 1);
  assert.equal(r.drafts.length, 1);
  assert.deepEqual(
    [r.drafts[0]!.kind, r.drafts[0]!.targetC, r.drafts[0]!.targetId],
    ["set-item", "sets", "set-1"],
  );
  assert.ok(r.needsYou && r.costCents > 0 && !r.repaired);
  assert.equal(reqs[0]!.model, "haiku");
  assert.match(reqs[0]!.messages[0]!.content, /\[e1\]/);
});

test("a fully sourced set does not need you", async () => {
  const r = await writePracticeSet(
    "j",
    input(),
    script(reply([q("e1"), q("e1")])),
  );
  assert.ok(r.ok && !r.needsYou && r.drafts.length === 0);
});

test("write with E.V. makes every item a draft against the set", async () => {
  const r = await writePracticeSet("j", input({ drafts: true }), {
    ...script(reply([q("e1"), q(null)])),
    system,
  });
  assert.ok(r.ok);
  assert.equal(r.items.length, 0);
  assert.deepEqual(
    r.drafts.map((d) => d.targetC),
    ["own_sets", "own_sets"],
  );
});

test("mock exam asks for an exam and allows up to 75 items", () => {
  assert.match(
    buildPrompt(parseInput(input({ variant: "mock_exam", count: 75 }))),
    /mock exam of 75/,
  );
  assert.throws(() => parseInput(input({ count: 31 })), /1 to 30/);
  assert.throws(() => parseInput(input({ variant: "quiz" })), /variant/);
});

test("a cited id that was not in the excerpts gets one repair ask, then succeeds", async () => {
  const { call, reqs } = script(
    reply([q("zz"), q("e1")]),
    reply([q("e1"), q("e1")]),
  );
  const r = await writePracticeSet("j", input(), { call, system });
  assert.ok(r.ok && r.repaired);
  assert.equal(reqs.length, 2);
  assert.match(reqs[1]!.messages.at(-1)!.content, /"zz"/);
});

test("forced invalid output fails cleanly after one repair, with nothing half-parsed", async () => {
  const bad = { text: "not json" };
  const { call, reqs } = script(bad, bad);
  const r = await writePracticeSet("j", input(), { call, system });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : "", /not usable/);
  assert.equal(reqs.length, 2);
  assert.ok(r.costCents > 0);
});

test("wrong answer keys fail the semantic check", async () => {
  const bad = reply([
    q("e1", { correct: [9] }),
    q("e1", { type: "sata", correct: [1] }),
  ]);
  const r = await writePracticeSet("j", input(), script(bad, bad));
  assert.ok(!r.ok);
  assert.match(r.reason, /do not exist|sata but has 1/);
});

test("max_tokens fails cleanly with the reason, no repair", async () => {
  const { call, reqs } = script({
    stopReason: "max_tokens",
    text: '{"items":[',
  });
  const r = await writePracticeSet("j", input(), { call, system });
  assert.ok(!r.ok);
  assert.match(r.reason, /ran out of room/);
  assert.equal(reqs.length, 1);
});

test("the schema sent to the model comes from the output schema and carries no ranges or patterns", () => {
  const s = JSON.stringify(outputSchema(practiceSet.outputSchema));
  assert.match(s, /"additionalProperties":false/);
  assert.match(s, /"sourceRef":\{"type":\["string","null"\]/);
  assert.doesNotMatch(s, /minimum|maximum|pattern|minLength|minItems/);
});

test("the public input names a scope only: a sent excerpts field is dropped, and bad scopes still fail", () => {
  const pub = parsePublicInput(
    input({ excerpts: [{ id: "forged", text: "x" }] }),
  );
  assert.ok(!("excerpts" in pub));
  assert.equal(pub.targetId, "set-1");
  assert.throws(() => parsePublicInput(input({ count: 31 })), /1 to 30/);
});

test("citations are checked against the gathered excerpts, not anything the caller named", async () => {
  const gathered = parseInput({
    ...parsePublicInput(input()),
    excerpts: [{ id: "n9", text: "Gathered." }],
  });
  const bad = reply([q("e1"), q("n9")]);
  const { call, reqs } = script(bad, reply([q("n9"), q("n9")]));
  const r = await writePracticeSet("j", gathered, { call, system });
  assert.ok(r.ok && r.repaired);
  assert.match(reqs[1]!.messages.at(-1)!.content, /"e1"/);
});
