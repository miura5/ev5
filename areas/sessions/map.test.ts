import { expect, test } from "vitest";
import { mapSessions } from "./map.ts";

const T0 = "2026-11-03T15:00:00.000Z";
const now = Date.parse(T0) + 10 * 60e3;
const doc = (over: object = {}) => ({
  schema: 2,
  writer: "page",
  at: T0,
  source: "E.V. Home",
  date: "2026-11-03",
  status: "active",
  topic: "Ch 42 Fluids",
  startedAt: T0,
  events: { "page-20261103-150000": { type: "start" } },
  ...over,
});

test("no sessions is the empty state", () => {
  expect(mapSessions([], now)).toBeUndefined();
  expect(mapSessions([{ id: "x", data: { nope: 1 } }], now)).toBeUndefined();
});

test("the running session wins and its clock is rebuilt", () => {
  const d = mapSessions(
    [
      {
        id: "old",
        data: doc({
          status: "ended",
          topic: "Old",
          startedAt: "2026-11-01T15:00:00.000Z",
        }),
      },
      { id: "now", data: doc() },
    ],
    now,
  );
  expect(d).toMatchObject({
    title: "Ch 42 Fluids",
    meta: "2026-11-03",
    seconds: 600,
    paused: false,
    ended: false,
  });
});

test("with none running, the latest one shows as ended", () => {
  const d = mapSessions(
    [{ id: "a", data: doc({ status: "ended", topic: undefined }) }],
    now,
  );
  expect(d?.title).toBe("Study session");
  expect(d?.ended).toBe(true);
});

test("B-873: a session with no startedAt counts from its write time, not 0:00", () => {
  const d = mapSessions(
    [{ id: "a", data: doc({ startedAt: null, events: undefined }) }],
    now,
  );
  expect(d?.seconds).toBe(600);
});

test("B-873: an ended session with no start shows its saved minutes", () => {
  const d = mapSessions(
    [
      {
        id: "a",
        data: doc({ status: "ended", startedAt: null, endedAt: T0, minutes: 25 }),
      },
    ],
    now,
  );
  expect(d?.seconds).toBe(1500);
});
