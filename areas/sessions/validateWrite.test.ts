import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { withEnd, withPause, withTellMe } from "./events.ts";

const raw = {
  schema: 2,
  writer: "page",
  at: "2026-11-03T15:00:00.000Z",
  source: "E.V. Home",
  date: "2026-11-03",
  status: "active",
  topic: "Fluids",
  startedAt: "2026-11-03T15:00:00.000Z",
  events: { "page-20261103-150000": { type: "start" } },
};

test("a session with a just-tell-me event passes ev4's write check", () => {
  const told = withTellMe(raw, new Date("2026-11-03T15:03:00Z"), "q7");
  expect(validateWrite("sessions", told, { prev: raw })).toEqual({ ok: true });
});

test("pause, resume and End stamp at and source, and pass ev4's write check", () => {
  const t = (min: number) => new Date(Date.parse(raw.at) + min * 60e3);
  const paused = withPause(raw, true, t(5), "a1");
  expect(paused).toMatchObject({ at: t(5).toISOString(), source: "E.V. Home", writer: "page" });
  expect(validateWrite("sessions", paused, { prev: raw })).toEqual({ ok: true });
  const back = withPause(paused, false, t(8), "b2");
  expect(validateWrite("sessions", back, { prev: paused })).toEqual({ ok: true });
  const done = withEnd(back, 12, t(12), "c3");
  expect(done.at).toBe(t(12).toISOString());
  expect(validateWrite("sessions", done, { prev: back })).toEqual({ ok: true });
});
