// the model call is its own step and its output is kept, so retrying the save step does not pay for the model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startJob, workflowExecutor } from "../runtime/index.ts";
import { runJob } from "../runtime/workflow.ts";
import type { Ceilings } from "../runtime/workflow.ts";
import type { Env, ModelCall } from "../runtime/index.ts";
import type { JobRecord, JobStore } from "../runtime/record.ts";
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

test("a result write that fails after it landed is retried and the model is called once", async () => {
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
  let putTries = 0;
  const store: PracticeStore = {
    put: async (j, r) => {
      kept.set(j, r);
      if (putTries++ === 0) throw new Error("D1 reply lost");
      return `r-${j}`;
    },
    get: async (j) => kept.get(j)!,
    find: async (j) => kept.get(j),
    save: async () => {},
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
  assert.equal(putTries, 2);
  assert.equal(modelCalls, 1);
  assert.equal((await jobs.get(job.id))!.state, "done");
});

for (const [kind, stopReason, text] of [
  ["a refusal", "refusal", ""],
  ["max_tokens", "max_tokens", "{"],
  ["output that fails its schema", "end_turn", JSON.stringify({ items: "no" })],
] as const)
  test(`${kind} ends the call step after one attempt, with no step retry`, async () => {
    const call: ModelCall = async () => ({ stopReason, text, usage: { inputTokens: 1000, outputTokens: 500 } });
    let reserves = 0;
    const store: PracticeStore = {
      put: async () => "r",
      get: async () => {
        throw new Error("unused");
      },
      save: async () => {},
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
    const ceilings: Ceilings = { reserve: async () => void reserves++, record: async () => {} };
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
    assert.equal((await jobs.get(job.id))!.state, "failed");
    assert.equal(reserves, 1);
  });

test("a result write that never landed is retried in the step and the model is called once", async () => {
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
  let putTries = 0;
  const store: PracticeStore = {
    put: async (j, r) => {
      if (putTries++ === 0) throw new Error("D1 unavailable");
      kept.set(j, r);
      return `r-${j}`;
    },
    get: async (j) => kept.get(j)!,
    find: async (j) => kept.get(j),
    save: async () => {},
  };
  const handlers = practiceSetHandlers({ store, call, system: "sys" });
  const out = await handlers.call!({
    jobId: "j1",
    input: {
      variant: "practice",
      targetId: "set-1",
      count: 2,
      objectives: [],
      excerpts: [{ id: "e1", text: "Mitochondria make ATP." }],
    },
    reserve: async () => {},
    spend: async () => {},
  } as never);
  assert.equal(modelCalls, 1);
  assert.equal(putTries, 2);
  assert.deepEqual(out, { ids: ["r-j1"] });
});
