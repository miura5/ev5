import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAskJobs } from "./useAskJobs.ts";

/** Stands in for the shell's ReadCopy (areas never import the shell): a good read is kept; a rejected fetch gets it back. */
function fakeCopy(kept: Record<string, unknown> = {}) {
  return {
    kept,
    async read<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
      try {
        const v = await fetcher();
        kept[key] = v;
        return v;
      } catch (e) {
        if (!(e instanceof TypeError) || !(key in kept)) throw e;
        return kept[key] as T;
      }
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const saved = [{ id: "j1", kind: "practice-set", state: "needs-you", summary: "Pick one" }];

test("offline, the saved jobs still show for the chat to point at", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
  const { result } = renderHook(() => useAskJobs(fakeCopy({ jobs: saved })));
  await waitFor(() => expect(result.current).toHaveLength(1));
  expect(result.current[0]!.job.value).toBe("needs you");
});

test("a 5xx stays quiet and shows nothing", async () => {
  localStorage.setItem("ev5.token", "t");
  const f = vi.fn(async () => new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", f);
  const copy = fakeCopy({ jobs: saved });
  const { result } = renderHook(() => useAskJobs(copy));
  await waitFor(() => expect(f).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 10));
  expect(result.current).toEqual([]);
});

test("open jobs use the plain title and one sentence", async () => {
  const { toAskJob } = await import("./useAskJobs.ts");
  const r = toAskJob({ id: "a", kind: "prep_plan", state: "needs-you", summary: "Your prep plan is ready. Approve it or put it away. It is waiting in Activity." });
  expect(r.job.title).toBe("Prep plan");
  expect(r.job.meta).toBe("Your prep plan is ready.");
});
