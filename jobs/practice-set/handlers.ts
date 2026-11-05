// The practice set job's step handlers (plan, call, save). Steps return ids, never content: the written items wait in a
// result store (keyed by job id, so a retried step writes the same row) until the save step puts them in D1.
import type { ModelCall } from "../runtime/output.ts";
import type { StepHandlers } from "../runtime/workflow.ts";
import { parseInput, practiceSet, writePracticeSet } from "./job.ts";
import type { PracticeResult } from "./job.ts";

type Written = Extract<PracticeResult, { ok: true }>;

export interface PracticeStore {
  put(jobId: string, r: Written): Promise<string>;
  get(jobId: string): Promise<Written>;
  /** A model failure noted once, so a step retry does not pay for the same failing call again. */
  putFailure(jobId: string, reason: string): Promise<void>;
  getFailure(jobId: string): Promise<string | undefined>;
  /** One batch: set items and pending drafts land together or not at all. */
  save(jobId: string, targetId: string, r: Written): Promise<void>;
}

export type PracticeDeps = {
  store: PracticeStore;
  call: ModelCall;
  system: string;
  frame?: (text: string, course?: string | null) => Promise<string>;
};

export function practiceSetHandlers({
  store,
  call,
  system,
  frame,
}: PracticeDeps): StepHandlers {
  return {
    plan: async (c) => ({ ids: [parseInput(c.input).targetId] }),
    call: async (c) => {
      const earlier = await store.getFailure(c.jobId);
      if (earlier) throw new Error(earlier);
      await c.reserve(practiceSet.costCapCents);
      const r = await writePracticeSet(c.jobId, c.input, { call, system, frame });
      await c.spend(r.costCents);
      if (!r.ok) {
        await store.putFailure(c.jobId, r.reason);
        throw new Error(r.reason);
      }
      return { ids: [await store.put(c.jobId, r)] };
    },
    save: async (c) => {
      const { targetId } = parseInput(c.input);
      await store.save(c.jobId, targetId, await store.get(c.jobId));
      return { ids: [targetId] };
    },
  };
}
