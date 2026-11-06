import { expect, test } from "vitest";
import { distinctJobs, toAskJob } from "./useAskJobs.ts";

test("two needs-you jobs that read the same show one card, as Activity lists them", () => {
  const w = { kind: "prep_plan", state: "needs-you", summary: "Plan needs you. Rate it.", lead: "Plan needs you." };
  const list = [{ id: "a", ...w }, { id: "b", ...w }, { id: "c", ...w, state: "running" }];
  expect(distinctJobs(list).map((j) => j.id)).toEqual(["a", "c"]);
});

test("uses the server's lead and reason fields", () => {
  const w = { id: "a", kind: "prep_plan", state: "needs-you", summary: "A. B. It is waiting in Activity.", lead: "Prep plan needs you.", reason: "Rate it." };
  expect(toAskJob(w).job.meta).toBe("Prep plan needs you.");
  expect(toAskJob({ ...w, state: "failed" }).job.meta).toBe("Rate it.");
});

test("old servers: falls back to trimming the summary", () => {
  const j = toAskJob({ id: "a", kind: "prep-plan", state: "needs-you", summary: "Plan needs you. Rate it. It is waiting in Activity." });
  expect(j.job.meta).toBe("Plan needs you.");
});
