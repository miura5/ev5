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
const planDoc = (id: string, title: string) => ({
  id,
  data: {
    days: [{ date: "2099-01-02", tasks: [{ text: title, minutes: 30 }] }],
  },
});
const docs = (planId: string, jobs: object[] = []) => ({
  exams: [examDoc(planId)],
  weakspots: [],
  sets: [],
  planedits: [{ id: "x1", data: { plan: planId } }],
  plans: [planDoc("plan-old", "Old plan"), planDoc("plan-new", "New plan")],
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
    kind: "study_plan",
    state: "running",
    examId: "x1",
  };
  const [e] = mapLibrary(docs("plan-old", [running]), now).exams;
  expect(e?.planState).toBe("working");
  expect(e?.sessions).toBeUndefined();
});
