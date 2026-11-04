import { expect, test } from "vitest";
import { toAskJob } from "./useAskJobs.ts";

test("uses the server's lead and reason fields", () => {
  const w = { id: "a", kind: "study_plan", state: "needs-you", summary: "A. B. It is waiting in Activity.", lead: "Study plan needs you.", reason: "Rate it." };
  expect(toAskJob(w).job.meta).toBe("Study plan needs you.");
  expect(toAskJob({ ...w, state: "failed" }).job.meta).toBe("Rate it.");
});

test("old servers: falls back to trimming the summary", () => {
  const j = toAskJob({ id: "a", kind: "study-plan", state: "needs-you", summary: "Plan needs you. Rate it. It is waiting in Activity." });
  expect(j.job.meta).toBe("Plan needs you.");
});
