import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { withTellMe } from "./tellLog.ts";

test("talk messages from a just-tell-me tap pass ev4's write check", () => {
  const now = new Date("2026-11-04T16:20:30Z");
  const first = withTellMe(null, "m2", now, "ab");
  expect(validateWrite("talk", first, { id: "2026-11-04" })).toEqual({
    ok: true,
  });
  const next = withTellMe(first, "m4", new Date(now.getTime() + 5000), "cd");
  expect(
    validateWrite("talk", next, { id: "2026-11-04", prev: first }),
  ).toEqual({ ok: true });
});

test("a later tap restamps writer, at and source on the talk document", () => {
  const now = new Date("2026-11-04T16:20:30Z");
  const first = withTellMe(null, "m2", now, "ab");
  const later = new Date(now.getTime() + 5000);
  const next = withTellMe(
    { ...first, at: "2026-11-04T01:00:00.000Z" },
    "m4",
    later,
    "cd",
  );
  expect(next).toMatchObject({
    writer: "page",
    at: later.toISOString(),
    source: "v5/ask",
  });
});
