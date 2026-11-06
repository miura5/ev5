import { expect, test } from "vitest";
import {
  approvePlan,
  checkUnique,
  parsePlanItemRow,
  parsePlanRow,
  planId,
  putAwayPlan,
  settle,
  planEnded,
  lastDay,
  endedReason,
} from "./index.ts";

const plan = {
  summary: "Heparin first.",
  tasks: [
    { date: "2026-11-03", title: "Heparin", minutes: 30, weakSpotId: "w1" },
    { date: "2026-11-03", title: "Review", minutes: 20 },
    { date: "2026-11-04", title: "Quiz", minutes: 25 },
  ],
};

test("approve makes one item per task, keyed by repeat and day, same on retry", () => {
  const a = approvePlan({ jobId: "j1", examId: "e1", plan, at: 5 });
  expect(a.plan).toMatchObject({
    id: "plan-j1",
    status: "approved",
    examId: "e1",
  });
  expect(a.items.map((i) => [i.repeat, i.day, i.weakSpotId])).toEqual([
    ["t1", "2026-11-03", "w1"],
    ["t2", "2026-11-03", null],
    ["t3", "2026-11-04", null],
  ]);
  expect(approvePlan({ jobId: "j1", examId: "e1", plan, at: 5 })).toEqual(a);
});

test("a repeat on a day twice is refused", () => {
  const [i] = approvePlan({ jobId: "j", examId: "e", plan, at: 1 }).items;
  expect(() => checkUnique([i!, { ...i! }])).toThrow(/repeated/);
});

test("put away keeps the plan row and no items", () => {
  const p = putAwayPlan({ jobId: "j1", examId: "e1", summary: "s", at: 2 });
  expect(p.plan.status).toBe("put_away");
  expect(p.items).toEqual([]);
  expect(p.plan.id).toBe(planId("j1"));
});

test("settle: write once, repeat is a no-op, the opposite is refused", () => {
  const saved = parsePlanRow(
    approvePlan({ jobId: "j", examId: "e", plan, at: 1 }).plan,
  );
  expect(settle(undefined, "approve")).toBe("write");
  expect(settle(saved, "approve")).toBe("same");
  expect(() => settle(saved, "put_away")).toThrow(/already approved/);
});

test("rows refuse bad shapes", () => {
  expect(() =>
    parsePlanItemRow({
      id: "a",
      planId: "p",
      repeat: "r",
      day: "11/3",
      title: "t",
      minutes: 30,
      weakSpotId: null,
      pos: 0,
    }),
  ).toThrow();
  expect(() =>
    parsePlanRow({
      id: "a",
      examId: "e",
      jobId: "j",
      status: "x",
      summary: "",
      at: 0,
    }),
  ).toThrow();
});

test("a plan has ended only when every day is before today", () => {
  expect(lastDay(["2026-11-03", "2026-11-05", "2026-11-04"])).toBe(
    "2026-11-05",
  );
  expect(planEnded(["2026-11-03", "2026-11-05"], "2026-11-06")).toBe(true);
  expect(planEnded(["2026-11-03", "2026-11-06"], "2026-11-06")).toBe(false);
  expect(planEnded([], "2026-11-06")).toBe(false);
  expect(endedReason("2026-11-05")).toMatch(/2026-11-05.*Plan again/);
});
