import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { buildAnswer } from "./answer.ts";

test("a rating's answers document passes ev4's write check", () => {
  const a = buildAnswer(
    "set-1",
    "q1",
    "good",
    "filling",
    new Date("2026-11-04T10:15:30Z"),
    "AbC9",
  );
  expect(validateWrite("answers", a.doc)).toEqual({ ok: true });
  const none = buildAnswer(
    "set-1",
    "q2",
    "again",
    "",
    new Date("2026-11-04T10:15:31Z"),
    "zz99",
  );
  expect(validateWrite("answers", none.doc)).toEqual({ ok: true });
});

test("a told answer passes ev4's write check", () => {
  const a = buildAnswer(
    "set-1",
    "q1",
    "told",
    "",
    new Date("2026-11-04T10:15:30Z"),
    "AbC9",
  );
  expect(validateWrite("answers", a.doc)).toEqual({ ok: true });
});
