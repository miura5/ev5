import { describe, expect, it } from "vitest";
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
