// the model call is its own step and its output is kept, so retrying the save step does not pay for the model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startJob, runJob, workflowExecutor } from "../runtime/index.ts";
import type { Ceilings, Env, JobRecord, JobStore } from "../runtime/index.ts";
import type { ModelCall } from "../runtime/index.ts";
import { fakeWorkflows } from "../runtime/workflow.fake.ts";
import { practiceSetHandlers } from "./handlers.ts";
import type { PracticeStore } from "./handlers.ts";
import { practiceSet } from "./job.ts";

const T = "2026-11-03T12:00:00Z";
const item = {
  stem: "Which action is first?",
  type: "single",
  options: ["a", "b", "c", "d"],
  correct: [1],
  rationales: ["w", "r", "w", "w"],
  sourceRef: "e1",
};

test("a save step that fails once is retried and the model is called once", async () => {
  let modelCalls = 0;
  const call: ModelCall = async () => {
    modelCalls++;
    return {
      stopReason: "end_turn",
      text: JSON.stringify({ items: [item, item] }),
      usage: { inputTokens: 1000, outputTokens: 500 },
    };
  };
  const kept = new Map<string, Parameters<PracticeStore["put"]>[1]>();
  let saveTries = 0;
  let saved = 0;
  const store: PracticeStore = {
    put: async (j, r) => (kept.set(j, r), `r-${j}`),
    get: async (j) => kept.get(j)!,
    putFailure: async () => {},
    getFailure: async () => undefined,
    save: async () => {
      if (++saveTries === 1) throw new Error("D1 write failed");
      saved++;
    },
  };
  const rows = new Map<string, JobRecord>();
  const jobs: JobStore = {
    get: async (id) => rows.get(id),
    list: async () => [...rows.values()],
    put: async (r) => {
      if ((rows.get(r.id)?.v ?? 0) + 1 !== r.v) return false;
      rows.set(r.id, r);
      return true;
    },
  };
  const ceilings: Ceilings = { reserve: async () => {}, record: async () => {} };
  const handlers = practiceSetHandlers({ store, call, system: "sys" });
  const wf = fakeWorkflows((step, p) =>
    runJob({ store: jobs, ceilings, now: () => T }, step, practiceSet, handlers, p),
  );
  let n = 0;
  const env: Env = {
    store: jobs,
    executors: { workflow: workflowExecutor(wf.adapter, "practice_set") },
    now: () => T,
    newId: () => `j${++n}`,
  };
  const job = await startJob(
    env,
    practiceSet,
    {
      variant: "practice",
      targetId: "set-1",
      count: 2,
      objectives: [],
      excerpts: [{ id: "e1", text: "Mitochondria make ATP." }],
    },
    "matt",
  );
  await wf.idle();
  assert.equal(saveTries, 2);
  assert.equal(saved, 1);
  assert.equal(modelCalls, 1);
  assert.equal((await jobs.get(job.id))!.state, "done");
});
