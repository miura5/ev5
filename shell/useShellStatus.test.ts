import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createReadCopy, memoryCopyStore } from "./readCopy.ts";
import { statusFromJobs, useShellStatus } from "./useShellStatus.ts";

describe("statusFromJobs", () => {
  it("counts needs-you under activity and names the running job", () => {
    const s = statusFromJobs([
      { id: "a", kind: "practice-set", state: "running", summary: "" },
      { id: "b", kind: "x", state: "needs-you", summary: "" },
    ]);
    expect(s.counts).toEqual({ activity: 1 });
    expect(s.runningJob).toEqual({ id: "a", text: "Practice set running" });
  });
  it("is empty when nothing is open", () => {
    expect(statusFromJobs([])).toEqual({ counts: {}, runningJob: undefined });
  });
});

describe("B-876: two needs-you records that read the same count once", () => {
  const w = { kind: "study_plan", state: "needs-you", summary: "Plan needs you. Rate it.", lead: "Plan needs you." };
  it("counts the sidebar like Activity lists them", () => {
    const s = statusFromJobs([{ id: "a", ...w }, { id: "b", ...w }, { id: "c", ...w, kind: "spend-alert", lead: "Over." }]);
    expect(s.counts).toEqual({ activity: 2 });
  });
});

describe("useShellStatus saved copy", () => {
  const job = { id: "a", kind: "practice-set", state: "running", summary: "" };
  const answer = (ok: boolean, jobs: unknown[]) =>
    (async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ jobs }) })) as unknown as typeof fetch;
  const offline = (async () => {
    throw new TypeError("offline");
  }) as unknown as typeof fetch;

  it("shows the saved job list when the connection fails, and a refusal stays quiet", async () => {
    localStorage.setItem("ev5.token", "t");
    const copy = createReadCopy(memoryCopyStore());
    const a = renderHook(() => useShellStatus(60_000, answer(true, [job]), copy));
    await waitFor(() => expect(a.result.current.runningJob?.id).toBe("a"));
    a.unmount();
    const b = renderHook(() => useShellStatus(60_000, offline, copy));
    await waitFor(() => expect(b.result.current.runningJob?.id).toBe("a"));
    expect(copy.usingCopy()).toBe(true);
    b.unmount();
    const c = renderHook(() => useShellStatus(60_000, answer(false, []), createReadCopy(memoryCopyStore())));
    await new Promise((r) => setTimeout(r, 20));
    expect(c.result.current).toEqual({ counts: {} });
  });
});

describe("useShellStatus polling", () => {
  it("fetches once on mount and once per interval, not on every render", async () => {
    localStorage.setItem("ev5.token", "t");
    vi.useFakeTimers();
    const real = globalThis.fetch;
    try {
      const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ jobs: [] }) }));
      globalThis.fetch = f as unknown as typeof fetch;
      // No doFetch passed: the default is a new function each render, as in App.tsx.
      const h = renderHook(() => useShellStatus(1000));
      await vi.advanceTimersByTimeAsync(10);
      h.rerender();
      h.rerender();
      await vi.advanceTimersByTimeAsync(10);
      expect(f).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(f).toHaveBeenCalledTimes(2);
      h.unmount();
    } finally {
      globalThis.fetch = real;
      vi.useRealTimers();
    }
  });
});
