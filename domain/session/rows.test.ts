import { expect, test } from "vitest";
import { parseSession } from "./parse.ts";
import { newSessionEventRow, newSessionRow, sessionDoc } from "./rows.ts";
import { parseSessionEventRow, parseSessionTableRow } from "./table.ts";
import { sessionState } from "./state.ts";

const T0 = "2026-10-18T15:00:00.000Z";
const doc = parseSession({
  schema: 2,
  writer: "page",
  at: T0,
  source: "E.V. Home",
  date: "2026-10-18",
  status: "active",
  kind: "note",
  startedAt: T0,
  planned: 25,
  noteId: "note_1",
  events: {
    "page-20261018-150000-aaa": { type: "start", at: T0 },
    "page-20261018-150700-bbb": {
      type: "break",
      at: "2026-10-18T15:07:00.000Z",
      quiet: true,
    },
  },
});

test("a session document becomes valid rows and reads back with its events and clock", () => {
  const row = { ...newSessionRow("ss-1", doc), at: 5, v: 2, deleted_at: null };
  expect(row.id).toBe("ses_ss-1");
  parseSessionTableRow(row);
  const events = Object.entries(doc.events ?? {}).map(([k, e]) => ({
    ...newSessionEventRow("ss-1", k, e),
    v: 1,
  }));
  for (const e of events) parseSessionEventRow(e);
  expect(events[1]?.body).toEqual({ quiet: true });
  expect(events[0]?.body).toBe(null);
  const back = sessionDoc(row, events);
  expect(Object.keys(back.events ?? {})).toEqual(Object.keys(doc.events ?? {}));
  expect(back.events?.["page-20261018-150700-bbb"]?.quiet).toBe(true);
  const now = Date.parse("2026-10-18T15:10:00.000Z");
  expect(sessionState({ ...back, id: "ss-1" }, now).onBreak).toBe(
    sessionState({ ...doc, id: "ss-1" }, now).onBreak,
  );
});

test("a session of another kind is refused, and an event with no readable time is refused", () => {
  expect(() => parseSession({ ...doc, kind: "skill" })).toThrow();
  expect(() => newSessionEventRow("ss-1", "page-x", { type: "start" })).toThrow(
    /no readable time/,
  );
});
