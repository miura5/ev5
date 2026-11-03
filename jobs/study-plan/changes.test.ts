import test from "node:test";
import assert from "node:assert/strict";
import type { ModelCall, ModelReply, ModelRequest } from "../runtime/output.ts";
import { applyPatch, askChanges, parsePatch } from "./changes.ts";
import type { Plan, PlanContext } from "./job.ts";

const ctx: PlanContext = {
  exam: { id: "e1", title: "Unit 3", kind: "unit", date: "2026-11-08" },
  today: "2026-11-03",
  days: ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"],
  weakSpots: [{ id: "w1", title: "Heparin", need: 1 }],
};
const draft: Plan = {
  summary: "Heparin first.",
  tasks: [
    { date: "2026-11-03", title: "Heparin", minutes: 30, weakSpotId: "w1" },
    { date: "2026-11-04", title: "Review", minutes: 20 },
  ],
};
const reply = (p: unknown): ModelReply => ({
  stopReason: "end_turn",
  text: JSON.stringify(p),
  usage: { inputTokens: 1000, outputTokens: 200 },
});
const fake = (...replies: unknown[]) => {
  const seen: ModelRequest[] = [];
  const call: ModelCall = async (req) => (
    seen.push(req),
    reply(replies.shift())
  );
  return { call, seen };
};

test("applies update, remove and add to a copy and leaves the draft alone", async () => {
  const { call, seen } = fake({
    ops: [
      { op: "update", task: 1, minutes: 45 },
      { op: "remove", task: 2 },
      {
        op: "add",
        date: "2026-11-05",
        title: "Quiz",
        minutes: 25,
        weakSpotId: "w1",
      },
    ],
    summary: "Longer heparin.",
  });
  const r = await askChanges(
    { call, system: "s" },
    { draft, ctx, note: "more heparin" },
  );
  assert.ok(r.ok);
  assert.deepEqual(
    r.plan.tasks.map((t) => [t.title, t.minutes]),
    [
      ["Heparin", 45],
      ["Quiz", 25],
    ],
  );
  assert.equal(r.plan.summary, "Longer heparin.");
  assert.equal(draft.tasks.length, 2);
  assert.equal(draft.tasks[0]?.minutes, 30);
  assert.equal(seen[0]?.model, "haiku");
  assert.ok(r.costCents > 0);
});

test("a patch that breaks a check gets one repair ask, then succeeds", async () => {
  const { call, seen } = fake(
    { ops: [{ op: "update", task: 2, date: "2026-12-25" }] },
    { ops: [{ op: "update", task: 2, date: "2026-11-06" }] },
  );
  const r = await askChanges(
    { call, system: "s" },
    { draft, ctx, note: "move it" },
  );
  assert.ok(r.ok);
  assert.equal(r.plan.tasks[1]?.date, "2026-11-06");
  assert.equal(seen.length, 2);
  assert.match(seen[1]?.messages.at(-1)?.content ?? "", /not study days/);
});

test("bad task number, invented spot and bad shapes fail in plain words", async () => {
  const bad = fake(
    { ops: [{ op: "remove", task: 9 }] },
    { ops: [{ op: "remove", task: 9 }] },
  );
  const r = await askChanges(
    { call: bad.call, system: "s" },
    { draft, ctx, note: "x" },
  );
  assert.ok(!r.ok);
  assert.match(r.reason, /no task 9/);
  const spot = fake(
    { ops: [{ op: "update", task: 1, weakSpotId: "zzz" }] },
    { ops: [{ op: "update", task: 1, weakSpotId: "zzz" }] },
  );
  const r2 = await askChanges(
    { call: spot.call, system: "s" },
    { draft, ctx, note: "x" },
  );
  assert.ok(!r2.ok);
  assert.match(r2.reason, /zzz/);
  assert.throws(
    () => parsePatch({ ops: [{ op: "nuke" }] }),
    /remove, add or update/,
  );
  assert.throws(() => parsePatch({}), /ops must be a list/);
  assert.throws(
    () => applyPatch(draft, { ops: [{ op: "update", task: 1, minutes: 5 }] }),
    /10 to 120/,
  );
});
