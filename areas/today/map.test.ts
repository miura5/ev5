import { expect, test } from "vitest";
import type { GoalRow, LinkRow, WeakSpotTableRow } from "../../domain/index.ts";
import { mapToday, spendAlertLine } from "./map.ts";
import type { PlanItemRow } from "./plans.ts";
import { goalRow, itemRow, planRow, spotRow } from "./testHost.tsx";

const now = Date.parse("2026-11-03T18:00:00Z"); // Tuesday 12:00 Central
const exam = (id: string, date: string, over: Partial<GoalRow> = {}) =>
  goalRow({ id, date, ...over });
const spot = (
  id: string,
  topic: string,
  over: Partial<WeakSpotTableRow> = {},
) => spotRow({ id, topic, ...over });
const link = (from_id: string, to_id: string): LinkRow => ({
  id: `link_${from_id}`,
  from_kind: "weak_spot",
  from_id,
  to_kind: "goal",
  to_id,
  by: "user",
  note: null,
  at: 1,
  v: 1,
  deleted_at: null,
});

/** A plan_items row Matt added (no plan, today unless `day` says otherwise). */
const item = (id: string, title: string, over: Partial<PlanItemRow> = {}) =>
  itemRow({ id, title, ...over });

test("no data is the empty day, not an error", () => {
  const d = mapToday({ goals: [], weakspots: [] }, now);
  expect(d.say.lead).toBe("Nothing planned yet.");
  expect([d.plan, d.upcoming, d.thisWeek]).toEqual([[], [], []]);
});

test("exams, weak spots and today's plan map to the view's props", () => {
  const d = mapToday(
    {
      goals: [
        exam("e4", "2026-11-05", { title: "Exam 4" }),
        exam("e5", "2026-11-20", { title: "Exam 5" }),
        exam("old", "2026-10-01", { status: "done" }),
        exam("undated", "2026-11-09", { date: null }),
      ],
      weakspots: [spot("w1", "Oral liquid doses")],
      links: [link("w1", "e4")],
      planItems: [
        item("a", "Review doses", { minutes: 10, done_at: 5 }),
        item("b", "Another day", { day: "2026-11-04" }),
      ],
    },
    now,
  );
  expect(d.say).toEqual({
    lead: "Exam 4 is in 2 days.",
    rest: "Your weakest spot is Oral liquid doses.",
    source: "from Weak spots",
  });
  expect(d.upcoming.map((u) => [u.id, u.when])).toEqual([
    ["e4", "Thu"],
    ["e5", "Nov 20"],
  ]);
  expect(d.upcoming[0]!.readiness).toEqual({ ready: 0, shaky: 0, weak: 1 });
  // e4 has one open weak spot and none reviewed; e5 has none yet: "none yet", not 0%.
  expect(d.upcoming[0]!.meta).toMatch(/· 0% ready/);
  expect(d.upcoming[1]!.meta).toMatch(/· readiness none yet/);
  expect(d.thisWeek.map((w) => w.id)).toEqual(["w-e4"]);
  expect(d.plan).toEqual([
    {
      id: "a",
      title: "Review doses",
      meta: "added by you",
      est: "10m",
      done: true,
    },
  ]);
});

test("spendAlertLine finds the needs-you spend alert only", () => {
  const j = (kind: string, state: string, summary: string) => ({
    kind,
    state,
    summary,
  });
  expect(spendAlertLine([j("prep-plan", "needs-you", "x")])).toBeUndefined();
  expect(spendAlertLine([j("spend-alert", "needs-you", "over")])).toBe("over");
});

test("Today's spend line is gone once the alert is acknowledged", () => {
  const line = { kind: "spend-alert", summary: "80% used" };
  expect(spendAlertLine([{ ...line, state: "needs-you" }])).toBe("80% used");
  expect(spendAlertLine([{ ...line, state: "done" }])).toBeUndefined();
});

test("a plan with items never says Nothing planned yet, and rows read as added by you", () => {
  const items = (a: number | null, b: number | null) => [
    item("a", "Review doses", { minutes: 10, done_at: a }),
    item("b", "Call clinic", { done_at: b }),
  ];
  const one = mapToday(
    { goals: [], weakspots: [], planItems: items(5, null) },
    now,
  );
  expect(one.say.lead).toBe("1 item is left on today's plan.");
  expect(one.plan.map((p) => [p.done, p.meta])).toEqual([
    [true, "added by you"],
    [false, "added by you"],
  ]);
  const all = mapToday(
    { goals: [], weakspots: [], planItems: items(5, 6) },
    now,
  );
  expect(all.say.lead).toBe("Today's plan is done.");
});

test("while the prep plan job still runs after Approve, the exam is not shown as approved", () => {
  const d = mapToday(
    {
      goals: [exam("e4", "2026-11-20")],
      weakspots: [],
      plans: [planRow({ id: "plan_old", goal_id: "e4" })],
      jobs: [
        { kind: "prep_plan", state: "running", summary: "", goalId: "e4" },
      ],
    },
    now,
  );
  expect(d.upcoming[0]?.plan).toBe("working");
});

test("a weekly review waiting for Matt is a Weekly review row in This week", () => {
  const job = (state: string) => ({
    kind: "weekly_review",
    state,
    summary: "5h 10m studied · 2 weak spots to confirm",
  });
  const waiting = mapToday(
    { goals: [], weakspots: [], jobs: [job("needs-you")] },
    now,
  );
  expect(waiting.thisWeek).toEqual([
    {
      id: "w-weekly-review",
      title: "Weekly review",
      meta: "5h 10m studied · 2 weak spots to confirm",
      when: "Sun",
    },
  ]);
  expect(
    mapToday({ goals: [], weakspots: [], jobs: [job("done")] }, now).thisWeek,
  ).toEqual([]);
});
