import { expect, test } from "vitest";
import { mapSessions as mapRows } from "./map.ts";
import { sessionRowsBody } from "./sessionRows.testkit.ts";
import type { SessionEventRow, SessionTableRow } from "../../domain/index.ts";

/** The old document list, put through the rows the server reads (§data.gate). */
const mapSessions = (docs: { id: string; data: object }[], now: number) =>
  mapRows(
    sessionRowsBody("sessions", docs).rows as SessionTableRow[],
    sessionRowsBody("session-events", docs).rows as SessionEventRow[],
    now,
  );

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
    meta: "Nov 3",
    seconds: 600,
    paused: false,
    ended: false,
  });
});

test("with only ended sessions there is no session to show (no stopped clock under live controls)", () => {
  expect(
    mapSessions(
      [
        { id: "a", data: doc({ status: "ended", endedAt: T0, minutes: 25 }) },
        { id: "b", data: doc({ status: "discarded" }) },
      ],
      now,
    ),
  ).toBeUndefined();
});

test("a session with no startedAt counts from its write time, not 0:00", () => {
  const d = mapSessions(
    [{ id: "a", data: doc({ startedAt: null, events: undefined }) }],
    now,
  );
  expect(d?.seconds).toBe(600);
});
