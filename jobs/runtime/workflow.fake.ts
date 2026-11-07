// In-memory Workflows for tests: instance ids are unique, steps are memoized per instance and retried by their policy.
import { isNonRetryable } from './non-retryable.ts';
import type { InstanceParams, StepConfig, StepRunner, WorkflowAdapter } from './workflow.ts';

export function fakeWorkflows(entry: (step: StepRunner, p: InstanceParams) => Promise<void>) {
  const ids = new Set<string>();
  const runs: Promise<void>[] = [];
  const adapter: WorkflowAdapter = {
    create: async (id, params) => {
      if (ids.has(id)) return 'exists';
      ids.add(id);
      const memo = new Map<string, unknown>();
      const step: StepRunner = {
        do: async <T>(name: string, c: StepConfig, fn: (x: { attempt: number }) => Promise<T>) => {
          if (memo.has(name)) return memo.get(name) as T;
          for (let attempt = 1; ; attempt++) {
            try {
              const v = await fn({ attempt });
              memo.set(name, v);
              return v;
            } catch (e) {
              if (isNonRetryable(e) || attempt > c.retries.limit) throw e;
            }
          }
        },
      };
      runs.push(entry(step, params));
      return 'created';
    },
  };
  return { adapter, idle: () => Promise.all(runs).then(() => undefined) };
}
