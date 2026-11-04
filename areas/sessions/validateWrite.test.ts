import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { withTellMe } from "./events.ts";

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
