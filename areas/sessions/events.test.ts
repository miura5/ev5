import { expect, test } from "vitest";
import { eventKey, withEnd, withPause, withTellMe } from "./events.ts";
import { mapSessions } from "./map.ts";

const T0 = "2026-11-03T15:00:00.000Z";
const raw = {
  schema: 2,
  writer: "page",
  at: T0,
  source: "E.V. Home",
  date: "2026-11-03",
  status: "active",
  topic: "Fluids",
  startedAt: T0,
  events: { "page-20261103-150000": { type: "start" } },
};
const at = (min: number) => new Date(Date.parse(T0) + min * 60e3);

test("keys carry the time", () => {
  expect(eventKey(at(0), "Ab-1")).toBe("page-20261103-150000-ab1");
});

test("a pause takes its minutes out of the study time", () => {
  const paused = withPause(raw, true, at(10), "a1");
  const d = mapSessions([{ id: "s", v: 1, data: paused }], at(15).getTime());
  expect(d).toMatchObject({ seconds: 600, paused: true });
  const back = withPause(paused, false, at(15), "b2");
  const e = mapSessions([{ id: "s", v: 1, data: back }], at(20).getTime());
  expect(e).toMatchObject({ seconds: 900, paused: false });
});

test("End marks it ended with its minutes for Progress", () => {
  const done = withEnd(raw, 12, at(12), "z9");
  expect(done).toMatchObject({
    status: "ended",
    minutes: 12,
    endedAt: at(12).toISOString(),
  });
  expect(Object.values(done.events as object)).toContainEqual(
    expect.objectContaining({ type: "end", why: "ended" }),
  );
});

test("Just tell me adds one answer event, keeps the rest, and passes ev4's write check", () => {
  const told = withTellMe(raw, at(3), "q7");
  const events = told.events as Record<string, unknown>;
  expect(Object.keys(events)).toHaveLength(2);
  expect(events["page-20261103-150300-q7"]).toEqual({
    type: "answer",
    at: at(3).toISOString(),
    why: "tell-me",
  });
  expect(events["page-20261103-150000"]).toEqual({ type: "start" });
});
