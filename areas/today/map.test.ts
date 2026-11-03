import { expect, test } from "vitest";
import { mapToday } from "./map.ts";

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
  expect(d.upcoming.map((u) => [u.id, u.when, u.tone])).toEqual([
    ["e4", "Thu", "bad"],
    ["e5", "Nov 20", "info"],
  ]);
  expect(d.upcoming[0]!.readiness).toEqual({ ready: 0, shaky: 0, weak: 1 });
  expect(d.thisWeek.map((w) => w.id)).toEqual(["w-e4"]);
  expect(d.plan).toEqual([
    {
      id: "a",
      title: "Review doses",
      meta: "review",
      est: "10m",
      done: true,
      tone: "ok",
    },
  ]);
});
