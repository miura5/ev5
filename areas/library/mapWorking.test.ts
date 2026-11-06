import { expect, test } from "vitest";
import { mapLibrary } from "./map.ts";

const base = {
  schema: 2,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "t",
};
const examDoc = (planId: string) => ({
  id: "x1",
  data: {
    ...base,
    title: "Exam Three",
    kind: "unit",
    date: "2099-01-05",
    planId,
  },
});
const item = (plan: string, title: string, day = "2099-01-02") => ({
  id: `pli_${plan}_${title}`,
  data: { plan_id: plan, day, title, minutes: 30 },
});
const docs = (planId: string, jobs: object[] = []) => ({
  exams: [examDoc(planId)],
  weakspots: [],
  sets: [],
  plans: [
    { id: "plan-old", data: { goal_id: "x1", state: "put_away" } },
    { id: "plan-new", data: { goal_id: "x1", state: "in_force" } },
  ].map((p) =>
    p.id === planId ? { ...p, data: { ...p.data, state: "in_force" } } : p,
  ),
  planItems: [item("plan-old", "Old plan"), item("plan-new", "New plan")],
  jobs: jobs as never,
});
const now = Date.parse("2026-11-05T18:00:00Z");

test("the Detail lists the plan the exam points at, not another approved plan", () => {
  const [e] = mapLibrary(docs("plan-new"), now).exams;
  expect(e?.planState).toBe("approved");
  expect(e?.sessions?.map((s) => s.title)).toEqual(["New plan"]);
});

test("right after Approve, while the plan job still runs, no earlier plan shows", () => {
  const running = {
    id: "j2",
    kind: "prep_plan",
    state: "running",
    goalId: "x1",
  };
  const [e] = mapLibrary(docs("plan-old", [running]), now).exams;
  expect(e?.planState).toBe("working");
  expect(e?.sessions).toBeUndefined();
});

test("a plan in force whose days have all passed reads as ended, not approved", () => {
  const past = {
    ...docs("plan-old"),
    planItems: [item("plan-old", "Old", "2026-11-04")],
  };
  expect(mapLibrary(past, now).exams[0]?.planState).toBe("ended");
  // The last day is still today (Central): the plan is not over.
  const same = Date.parse("2026-11-04T18:00:00Z");
  expect(mapLibrary(past, same).exams[0]?.planState).toBe("approved");
});
