import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { buildDayEdit } from "./dayedit.ts";

const now = new Date("2026-11-04T10:15:30Z");
const added = {
  "rep-x1-2026-11-04": {
    text: "Read chapter 4",
    kind: "reading",
    minutes: 30,
    at: "2026-11-04T08:00:00Z",
    by: "Matt",
  },
};

test("a first tick on a day with no document passes ev4's write check", () => {
  const doc = buildDayEdit(undefined, "2026-11-04", "a", true, now);
  expect(doc.checks).toEqual({ a: { at: "2026-11-04T10:15:30Z", by: "Matt" } });
  expect(validateWrite("dayedits", doc)).toEqual({ ok: true });
});

test("a tick on an existing document keeps its items and passes the check", () => {
  const prev = {
    ...buildDayEdit(undefined, "2026-11-04", "x", true, now),
    added,
    skipped: { s: { at: "2026-11-04T09:00:00Z", by: "Matt" } },
    checkin: null,
  };
  const doc = buildDayEdit(prev, "2026-11-04", "rep-x1-2026-11-04", true, now);
  expect(doc.added).toEqual(added);
  expect(doc.skipped).toEqual(prev.skipped);
  expect(Object.keys(doc.checks ?? {})).toEqual(["x", "rep-x1-2026-11-04"]);
  expect(validateWrite("dayedits", doc, { prev })).toEqual({ ok: true });
});

test("an un-tick removes only that check and passes the check", () => {
  const prev = buildDayEdit(undefined, "2026-11-04", "a", true, now);
  const doc = buildDayEdit(prev, "2026-11-04", "a", false, now);
  expect(doc.checks).toEqual({});
  expect(validateWrite("dayedits", doc)).toEqual({ ok: true });
});
