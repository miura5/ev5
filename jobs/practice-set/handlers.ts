// The practice set job's step handlers (plan, call, keep, save). Steps return ids, never content: the written items wait in a
// result store (keyed by job id, so a retried step writes the same row) until the save step puts them in D1.
import { billedOnThrow, type ModelCall } from "../runtime/output.ts";
import { NonRetryableError } from "../runtime/non-retryable.ts";
import type { StepHandlers } from "../runtime/workflow.ts";
import { parseInput, practiceSet, writePracticeSet } from "./job.ts";
import type { PracticeResult } from "./job.ts";

type Written = Extract<PracticeResult, { ok: true }>;

export interface PracticeStore {
  put(jobId: string, r: Written): Promise<string>;
  get(jobId: string): Promise<Written>;
  /** The kept result if the call step already stored it (its step result was lost), else undefined. */
  find?(jobId: string): Promise<Written | undefined>;
  /** One batch: set items and pending drafts land together or not at all. */
  save(jobId: string, targetId: string, r: Written): Promise<void>;
}

export type PracticeDeps = {
  store: PracticeStore;
  call: ModelCall;
  system: string;
};

export function practiceSetHandlers({
  store,
  call,
  system,
}: PracticeDeps): StepHandlers {
  return {
    plan: async (c) => ({ ids: [parseInput(c.input).targetId] }),
    call: async (c) => {
      // The result is already kept (a retry after the write landed): the model is not paid for again.
      if (await store.find?.(c.jobId)) return { ids: [`${c.jobId}:result`] };
      await c.reserve(practiceSet.costCapCents);
      const r = await billedOnThrow(c.spend, () =>
        writePracticeSet(c.jobId, c.input, { call, system }),
      );
      await c.spend(r.costCents);
      if (!r.ok) throw new NonRetryableError(r.reason);
      // No D1 write here: the result goes to the next step in the Workflow's step state (§job.steps).
      return { ids: [`${c.jobId}:result`], carry: r };
    },
    keep: async (c) => {
      const r = c.carried?.call as Written | undefined;
      if (!r) return { ids: [`${c.jobId}:result`] }; // the call step found it already kept
      return { ids: [await store.put(c.jobId, r)] };
    },
    save: async (c) => {
      const { targetId } = parseInput(c.input);
      await store.save(c.jobId, targetId, await store.get(c.jobId));
      return { ids: [targetId] };
    },
  };
}
