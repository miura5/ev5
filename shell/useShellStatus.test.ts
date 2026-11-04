import { describe, expect, it } from "vitest";
import { statusFromJobs } from "./useShellStatus.ts";

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
