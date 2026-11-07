import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ModelCall } from "../runtime/index.ts";
import type { ModelReply } from "../runtime/output.ts";
import { parseSet } from "../../domain/index.ts";
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
  objectives: ["Cell respiration"],
  excerpts: [{ id: "note_e1", text: "Mitochondria make ATP..." }],
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
  const { call, reqs } = script(reply([q("note_e1"), q(null)]));
  const r = await writePracticeSet("job-1", input(), { call, system });
  assert.ok(r.ok);
  assert.equal(r.items.length, 1);
  assert.equal(r.drafts.length, 1);
  assert.deepEqual(
    [r.drafts[0]!.kind, r.drafts[0]!.target_kind, r.drafts[0]!.target_id],
    ["set-item", "sets", "set-1"],
  );
  assert.ok(r.needsYou && r.costCents > 0 && !r.repaired);
  assert.equal(reqs[0]!.model, "haiku");
  assert.match(reqs[0]!.messages[0]!.content, /\[note_e1\]/);
});

test("a fully sourced set does not need you", async () => {
  const r = await writePracticeSet(
    "j",
    input(),
    script(reply([q("note_e1"), q("note_e1")])),
  );
  assert.ok(r.ok && !r.needsYou && r.drafts.length === 0);
});

test("write with E.V. makes every item a draft against the set", async () => {
  const r = await writePracticeSet("j", input({ drafts: true }), {
    ...script(reply([q("note_e1"), q(null)])),
    system,
  });
  assert.ok(r.ok);
  assert.equal(r.items.length, 0);
  assert.deepEqual(
    r.drafts.map((d) => d.target_kind),
    ["own_sets", "own_sets"],
  );
});

test("a full practice run asks for one and allows up to 75 items", () => {
  assert.match(
    buildPrompt(parseInput(input({ variant: "full_run", count: 75 }))),
    /full practice run of 75/,
  );
  assert.throws(() => parseInput(input({ variant: "mock_exam" })), /variant/);
  assert.throws(() => parseInput(input({ count: 31 })), /1 to 30/);
  assert.throws(() => parseInput(input({ variant: "quiz" })), /variant/);
});

test("a cited id that was not in the excerpts gets one repair ask, then succeeds", async () => {
  const { call, reqs } = script(
    reply([q("note_zz"), q("note_e1")]),
    reply([q("note_e1"), q("note_e1")]),
  );
  const r = await writePracticeSet("j", input(), { call, system });
  assert.ok(r.ok && r.repaired);
  assert.equal(reqs.length, 2);
  assert.match(reqs[1]!.messages.at(-1)!.content, /"note_zz"/);
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
    q("note_e1", { correct: [9] }),
    q("note_e1", { type: "multi_select", correct: [1] }),
  ]);
  const r = await writePracticeSet("j", input(), script(bad, bad));
  assert.ok(!r.ok);
  assert.match(r.reason, /do not exist|multi_select but has 1/);
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
  // The SDK helper moves rules it cannot enforce into a description; none stays as a keyword.
  assert.doesNotMatch(s, /"(minimum|maximum|pattern|minLength|minItems)":/);
});

test("the public input names a scope only: a sent excerpts field is dropped, and bad scopes still fail", () => {
  const pub = parsePublicInput(
    input({ excerpts: [{ id: "forged", text: "x" }] }),
  );
  assert.ok(!("excerpts" in pub));
  assert.equal(pub.targetId, "set-1");
  assert.throws(() => parsePublicInput(input({ count: 31 })), /1 to 30/);
});

test("a scope may name a collection or a note to draw from, with or without objectives", () => {
  const pub = parsePublicInput(
    input({
      objectives: [],
      source: { kind: "collection", id: "col_spanish" },
    }),
  );
  assert.deepEqual(pub.source, { kind: "collection", id: "col_spanish" });
  assert.deepEqual(pub.objectives, []);
  assert.equal(parsePublicInput(input()).source, undefined);
  assert.throws(
    () => parsePublicInput(input({ source: { kind: "course", id: "x" } })),
    /collection or note/,
  );
  assert.throws(
    () => parsePublicInput(input({ source: { kind: "note", id: "" } })),
    /source id is required/,
  );
});

test("citations are checked against the gathered excerpts, not anything the caller named", async () => {
  const gathered = parseInput({
    ...parsePublicInput(input()),
    excerpts: [{ id: "note_n9", text: "Gathered." }],
  });
  const bad = reply([q("note_e1"), q("note_n9")]);
  const { call, reqs } = script(bad, reply([q("note_n9"), q("note_n9")]));
  const r = await writePracticeSet("j", gathered, { call, system });
  assert.ok(r.ok && r.repaired);
  assert.match(reqs[1]!.messages.at(-1)!.content, /"note_e1"/);
});

test("stored items are domain set items: an id, and a sourceRef note_…", async () => {
  const r = await writePracticeSet(
    "job-7",
    input({
      excerpts: [
        { id: "note_e1", text: "x" },
        { id: "note_n2", text: "y" },
      ],
    }),
    { ...script(reply([q("note_e1"), q("note_n2")])), system },
  );
  assert.ok(r.ok);
  assert.deepEqual(
    r.items.map((i) => [i.id, i.sourceRef]),
    [
      ["job-7:i0", "note_e1"],
      ["job-7:i1", "note_n2"],
    ],
  );
  const set = parseSet({
    schema: 3,
    writer: "worker",
    at: "t",
    source: "s",
    kind: "job",
    items: r.items,
  });
  assert.equal(set.items.length, 2);
});

test("an item the domain refuses gets one repair ask, then is refused with the reason", async () => {
  const seven = q("note_e1", {
    options: ["1", "2", "3", "4", "5", "6", "7"],
    rationales: ["1", "2", "3", "4", "5", "6", "7"],
  });
  const bad = reply([seven, q("note_e1")]);
  const { call, reqs } = script(bad, bad);
  const r = await writePracticeSet("j", input(), { call, system });
  assert.ok(!r.ok);
  assert.equal(reqs.length, 2);
  assert.match(reqs[1]!.messages.at(-1)!.content, /Item 1 options/);
});
