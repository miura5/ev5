import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useJobs } from "./useJobs.ts";

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

const saved = [{ id: "j1", kind: "study-plan", state: "running", summary: "Working" }];

test("offline, the saved list shows and no error is raised", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
  const { result } = renderHook(() => useJobs(fakeCopy({ jobs: saved })));
  await waitFor(() => expect(result.current.jobs).toHaveLength(1));
  expect(result.current.jobs[0]!.title).toBe("Study plan");
  expect(result.current.error).toBeUndefined();
});

test("a server error does not show the saved list and keeps it", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
  const copy = fakeCopy({ jobs: saved });
  const { result } = renderHook(() => useJobs(copy));
  await waitFor(() => expect(result.current.error).toBe("Something went wrong on E.V.'s side. Try again in a moment."));
  expect(result.current.jobs).toEqual([]);
  expect(copy.kept.jobs).toBe(saved);
});

test("a 401 shows no data and keeps the saved copy", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
  const copy = fakeCopy({ jobs: saved });
  const { result } = renderHook(() => useJobs(copy));
  await waitFor(() => expect(result.current.refused).toBe(true));
  expect(result.current.jobs).toEqual([]);
  expect(copy.kept.jobs).toBe(saved);
});

test("a good read refreshes the copy", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jobs: saved }), { status: 200 })));
  const copy = fakeCopy();
  const { result } = renderHook(() => useJobs(copy));
  await waitFor(() => expect(result.current.jobs).toHaveLength(1));
  expect(copy.kept.jobs).toEqual(saved);
});
