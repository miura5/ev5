import { expect, test } from "vitest";
import { mapToday, spendAlertLine } from "./map.ts";

const now = Date.parse("2026-11-03T18:00:00Z"); // Tuesday 12:00 Central
const exam = (date: string, extra: object = {}) => ({
  schema: 2,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "test",
  title: "Exam 4",
  kind: "unit",
  date,
  ...extra,
});
const spot = (topic: string, over: object = {}) => ({
  schema: 2,
  writer: "page",
  at: "2026-10-15T15:00:00Z",
  source: "test",
  topic,
  objective: "E4-3",
  exam: "e4",
  kind: "concept",
  initial: { streak: 0, nextDue: "2026-11-04", recurrence: 1, misses: 2 },
  events: {},
  ...over,
});

test("no data is the empty day, not an error", () => {
  const d = mapToday({ exams: [], weakspots: [] }, now);
  expect(d.say.lead).toBe("Nothing planned yet.");
  expect([d.plan, d.upcoming, d.thisWeek]).toEqual([[], [], []]);
});

test("exams, weak spots and today's plan map to the view's props", () => {
  const d = mapToday(
    {
      exams: [
        { id: "e4", data: exam("2026-11-05") },
        { id: "e5", data: exam("2026-11-20", { title: "Exam 5" }) },
        { id: "old", data: exam("2026-10-01", { status: "done" }) },
        { id: "bad", data: { nope: 1 } },
      ],
      weakspots: [{ id: "w1", data: spot("Oral liquid doses") }],
      dayedit: {
        id: "2026-11-03",
        data: {
          added: {
            a: { text: "Review doses", kind: "review", minutes: 10 },
            b: { text: "Skipped", kind: "todo" },
          },
          checks: { a: { at: "x" } },
          skipped: { b: { at: "x", by: "Matt" } },
        },
      },
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
      meta: "review · added by you",
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
  const dayedit = (checks: object) => ({
    id: "2026-11-03",
    data: {
      added: {
        a: { text: "Review doses", kind: "review", minutes: 10 },
        b: { text: "Call clinic", kind: "todo" },
      },
      checks,
    },
  });
  const one = mapToday(
    { exams: [], weakspots: [], dayedit: dayedit({ a: { at: "x" } }) },
    now,
  );
  expect(one.say.lead).toBe("1 item is left on today's plan.");
  expect(one.plan.map((p) => [p.done, p.meta])).toEqual([
    [true, "review · added by you"],
    [false, "added by you"],
  ]);
  const all = mapToday(
    {
      exams: [],
      weakspots: [],
      dayedit: dayedit({ a: { at: "x" }, b: { at: "x" } }),
    },
    now,
  );
  expect(all.say.lead).toBe("Today's plan is done.");
});

test("while the prep plan job still runs after Approve, the exam is not shown as approved", () => {
  const d = mapToday(
    {
      exams: [{ id: "e4", data: exam("2026-11-20", { planId: "plan-old" }) }],
      weakspots: [],
      plans: [{ id: "plan-old", data: { goal_id: "e4", state: "in_force" } }],
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
    { exams: [], weakspots: [], jobs: [job("needs-you")] },
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
    mapToday({ exams: [], weakspots: [], jobs: [job("done")] }, now).thisWeek,
  ).toEqual([]);
});
